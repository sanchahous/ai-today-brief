import {
  compileAutoVisualClaim,
  overlayDirectivesForLabels,
  parseAutoVisualClaim,
  type AutoVisualClaim,
  type HoldoutStoryInput,
  type VisualGlyph,
  type VisualOutcomeSignal,
  type VisualRelation,
} from './visual-auto-claim';
import type {
  PrimaryVisualEvidence,
  VisualFormat,
  VisualPlan,
} from './visual-compiler';

export const VISUAL_EXPLANATORY_ROLES = [
  'causal_mechanism',
  'architecture_transformation',
  'state_transition',
  'quantitative_result',
  'benchmark_comparison',
  'capability_access',
  'policy_control',
  'uncertainty_announcement',
] as const;

export type VisualExplanatoryRole = (typeof VISUAL_EXPLANATORY_ROLES)[number];

export const VISUAL_CERTAINTIES = [
  'observed',
  'released',
  'reported',
  'claimed',
  'planned',
  'expected',
  'uncertain',
] as const;

export type VisualCertainty = (typeof VISUAL_CERTAINTIES)[number];

export const VISUAL_MAPPING_MODES = ['literal', 'editorial_analogy'] as const;
export type VisualMappingMode = (typeof VISUAL_MAPPING_MODES)[number];

export const VISUAL_METRIC_DIRECTIONS = [
  'increase',
  'decrease',
  'higher_is_better',
  'lower_is_better',
  'neutral',
] as const;

export type VisualMetricDirection = (typeof VISUAL_METRIC_DIRECTIONS)[number];

export interface VisualMetricSemantics {
  direction: VisualMetricDirection;
  comparisonTarget: string;
  baselineLabel: string;
  resultLabel: string;
}

export interface VisualSemanticsV5 {
  explanatoryRole: VisualExplanatoryRole;
  certainty: VisualCertainty;
  mappingMode: VisualMappingMode;
  visualDriver: string;
  metric: VisualMetricSemantics | null;
  requiredVisibleDelta: string;
  sourceGuardTerms: string[];
}

export interface AutoVisualClaimV5 extends AutoVisualClaim {
  semantics: VisualSemanticsV5;
}

interface RawMetric {
  direction?: unknown;
  comparison_target?: unknown;
  baseline_label?: unknown;
  result_label?: unknown;
}

interface RawGrammar {
  context_glyph?: unknown;
  mechanism_glyph?: unknown;
  outcome_glyph?: unknown;
  branch_glyphs?: unknown;
  relation?: unknown;
  outcome_signal?: unknown;
  human_behavior?: unknown;
}

interface RawV5Claim {
  story_id?: unknown;
  explanatory_role?: unknown;
  certainty?: unknown;
  mapping_mode?: unknown;
  identity?: unknown;
  change?: unknown;
  visual_driver?: unknown;
  visible_outcome?: unknown;
  core_claim?: unknown;
  metric?: unknown;
  labels?: unknown;
  quantitative_facts?: unknown;
  states?: unknown;
  comparison?: unknown;
  layers?: unknown;
  routing?: unknown;
  required_visible_delta?: unknown;
  forbidden_contradictions?: unknown;
  grammar?: unknown;
}

const ROLES = new Set<string>(VISUAL_EXPLANATORY_ROLES);
const CERTAINTIES = new Set<string>(VISUAL_CERTAINTIES);
const MAPPING_MODES = new Set<string>(VISUAL_MAPPING_MODES);
const METRIC_DIRECTIONS = new Set<string>(VISUAL_METRIC_DIRECTIONS);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clean(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function normalizedEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<string>,
  fallback: T,
): T {
  const normalized = clean(value, 60).toLowerCase().replace(/[\s-]+/g, '_');
  return allowed.has(normalized) ? (normalized as T) : fallback;
}

function uniqueStrings(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => clean(item, maxLength)).filter(Boolean))].slice(
    0,
    maxItems,
  );
}

function sourceText(story: HoldoutStoryInput): string {
  return [story.title, story.summary, story.why ?? '', story.practical ?? '', story.takeaway ?? '']
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferSourceCertainty(story: HoldoutStoryInput): VisualCertainty {
  const source = sourceText(story).toLowerCase();
  if (
    /\b(prepares?|planning|plans?|set to|is set to|expected|expects?|aims?|will launch|upcoming|preview)\b/.test(
      source,
    )
  ) {
    return /\bexpected|expects?\b/.test(source) ? 'expected' : 'planned';
  }
  if (/\b(claims?|promis(?:e|es|ing)|positions?|says it can)\b/.test(source)) return 'claimed';
  if (/\b(reports?|reported|self-reported|according to|the supplied report)\b/.test(source)) {
    return 'reported';
  }
  if (/\b(released|launched|introduced|open-sourced|made permanent|renamed|added)\b/.test(source)) {
    return 'released';
  }
  if (/\b(measured|found|analysis|achieved|reached|completed|reveals?)\b/.test(source)) {
    return 'observed';
  }
  return 'reported';
}

function certaintyAssertiveness(value: VisualCertainty): number {
  switch (value) {
    case 'uncertain':
      return 0;
    case 'planned':
    case 'expected':
    case 'claimed':
      return 1;
    case 'reported':
      return 2;
    case 'released':
      return 3;
    case 'observed':
      return 4;
  }
}

function guardedCertainty(
  requested: VisualCertainty,
  source: VisualCertainty,
): { certainty: VisualCertainty; warning: string | null } {
  if (requested === source) return { certainty: source, warning: null };
  if (certaintyAssertiveness(requested) > certaintyAssertiveness(source)) {
    return {
      certainty: source,
      warning: `certainty_downgraded_${requested}_to_${source}`,
    };
  }
  return {
    certainty: source,
    warning: `certainty_aligned_${requested}_to_${source}`,
  };
}

function inferRole(raw: RawV5Claim, story: HoldoutStoryInput): VisualExplanatoryRole {
  const requested = normalizedEnum<VisualExplanatoryRole>(
    raw.explanatory_role,
    ROLES,
    'causal_mechanism',
  );
  if (ROLES.has(clean(raw.explanatory_role, 60).toLowerCase().replace(/[\s-]+/g, '_'))) {
    return requested;
  }
  const source = sourceText(story).toLowerCase();
  const facts = Array.isArray(raw.quantitative_facts) ? raw.quantitative_facts : [];
  if (/\b(prepares?|set to|expected|aims?|planned|upcoming)\b/.test(source)) {
    return 'uncertainty_announcement';
  }
  if (/\bbenchmark|evaluation|leaderboard|tops?|pass rate|score\b/.test(source) && facts.length) {
    return 'benchmark_comparison';
  }
  if (facts.length || /\b\d+(?:\.\d+)?%|\b\d+x\b|half the cost|fewer tokens|lower latency\b/i.test(source)) {
    return 'quantitative_result';
  }
  if (/\bpolicy|access control|authori[sz]|blocked|refused|guardrail\b/.test(source)) {
    return 'policy_control';
  }
  if (/\blower|compile|compiler|dialect|layer|stack|strip|prun|compact|transform\b/.test(source)) {
    return 'architecture_transformation';
  }
  if (/\b(before|after|resume|restart|reversal|becomes|moves?)\b/.test(source)) {
    return 'state_transition';
  }
  if (/\b(released|launched|introduced|open-sourced|adds?|enables?|grants?|brings?)\b/.test(source)) {
    return 'capability_access';
  }
  return requested;
}

function sourceHasExactMetric(story: HoldoutStoryInput): boolean {
  return /(?:[$€£]\s*\d|\b\d+(?:\.\d+)?\s*(?:%|x|×|million|billion|trillion|tokens?|milliseconds?|ms|seconds?|minutes?|hours?)\b)/i.test(
    sourceText(story),
  );
}

function guardExplanatoryRole(
  requested: VisualExplanatoryRole,
  raw: RawV5Claim,
  story: HoldoutStoryInput,
): { role: VisualExplanatoryRole; warning: string | null } {
  if (
    requested !== 'quantitative_result' &&
    requested !== 'benchmark_comparison'
  ) {
    return { role: requested, warning: null };
  }
  const facts = Array.isArray(raw.quantitative_facts)
    ? raw.quantitative_facts
    : [];
  if (facts.length > 0 || sourceHasExactMetric(story)) {
    return { role: requested, warning: null };
  }
  const source = sourceText(story);
  const role: VisualExplanatoryRole =
    /\b(by|because|via|using|converts?|converting|intercepts?|caching|compression|compresses?|proxy|fuzzing|property-based)\b/i.test(
      source,
    )
      ? 'causal_mechanism'
      : 'capability_access';
  return {
    role,
    warning: `role_aligned_${requested}_to_${role}_without_exact_metric`,
  };
}

function inferMetricDirection(raw: RawMetric, story: HoldoutStoryInput): VisualMetricDirection {
  const requested = normalizedEnum<VisualMetricDirection>(
    raw.direction,
    METRIC_DIRECTIONS,
    'neutral',
  );
  if (requested !== 'neutral') return requested;
  const source = sourceText(story).toLowerCase();
  if (/\b(reduce|reduces|reduced|lower|less|fewer|cut|cuts|half the cost|saving|shrinks?)\b/.test(source)) {
    return 'decrease';
  }
  if (/\b(increase|increases|higher|more than|tops?|top position|improv|up to|trillion|larger)\b/.test(source)) {
    return 'increase';
  }
  return 'neutral';
}

function inferComparisonTarget(raw: RawMetric, story: HoldoutStoryInput): string {
  const explicit = clean(raw.comparison_target, 100);
  if (explicit) return explicit;
  const source = sourceText(story);
  const match = source.match(/(?:than|versus|vs\.?|compared (?:with|to)|of)\s+([^.;,]{3,80})/i);
  return match?.[1]?.trim().slice(0, 100) ?? '';
}

function roleEvidence(role: VisualExplanatoryRole, raw: RawV5Claim): PrimaryVisualEvidence {
  switch (role) {
    case 'architecture_transformation':
      return 'architecture_change';
    case 'state_transition':
      return 'temporal_change';
    case 'quantitative_result':
    case 'benchmark_comparison':
      return 'quantitative_difference';
    case 'uncertainty_announcement':
      return 'counterfactual_comparison';
    case 'capability_access':
    case 'policy_control':
    case 'causal_mechanism':
      return record(raw.routing).branches ? 'task_routing' : 'physical_action';
  }
}

function guardedMappingMode(
  requested: VisualMappingMode,
  role: VisualExplanatoryRole,
): { mode: VisualMappingMode; warning: string | null } {
  const analogyAllowed =
    role === 'causal_mechanism' || role === 'policy_control' || role === 'capability_access';
  if (requested === 'editorial_analogy' && !analogyAllowed) {
    return { mode: 'literal', warning: `analogy_disabled_for_${role}` };
  }
  return { mode: requested, warning: null };
}

function uncertaintyPhrase(certainty: VisualCertainty): string {
  switch (certainty) {
    case 'planned':
      return 'is planned to';
    case 'expected':
      return 'is expected to';
    case 'claimed':
      return 'is claimed to';
    case 'reported':
      return 'is reported to';
    case 'uncertain':
      return 'may';
    case 'released':
    case 'observed':
      return '';
  }
}

function guardCoreClaim(
  rawCoreClaim: string,
  identity: string,
  change: string,
  outcome: string,
  certainty: VisualCertainty,
): { coreClaim: string; warning: string | null } {
  if (certainty === 'released' || certainty === 'observed') {
    return { coreClaim: rawCoreClaim, warning: null };
  }
  const hasGuard = /\b(expected|planned|prepares?|set to|aims?|reported|claims?|may|could|preview)\b/i.test(
    rawCoreClaim,
  );
  if (hasGuard) return { coreClaim: rawCoreClaim, warning: null };
  const phrase = uncertaintyPhrase(certainty);
  const coreClaim = `${identity} ${phrase} ${change || outcome}`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
  return { coreClaim, warning: `core_claim_guarded_for_${certainty}` };
}

function sourceGuardTerms(story: HoldoutStoryInput): string[] {
  const source = sourceText(story);
  const matches = source.match(
    /\b(prepares?|planned|set to|expected|aims?|reports?|reported|self-reported|claims?|promising|may|could|up to)\b/gi,
  );
  return [...new Set((matches ?? []).map((value) => value.toLowerCase()))].slice(0, 8);
}

function defaultComparison(
  role: VisualExplanatoryRole,
  story: HoldoutStoryInput,
  metric: VisualMetricSemantics | null,
  change: string,
  outcome: string,
): { left: string; right: string } | null {
  if (role === 'uncertainty_announcement') {
    return {
      left: 'the current confirmed state before the announced model or capability exists',
      right: `the ${metric?.resultLabel || 'expected future state'} shown with an explicit unconfirmed boundary`,
    };
  }
  if (role === 'quantitative_result' || role === 'benchmark_comparison') {
    return {
      left: metric?.baselineLabel || metric?.comparisonTarget || 'reported baseline or comparison target',
      right: metric?.resultLabel || change || outcome,
    };
  }
  return null;
}

function labelsFromRaw(raw: RawV5Claim): string[] {
  return uniqueStrings(raw.labels, 3, 34);
}

function formatForClaim(claim: AutoVisualClaim): VisualFormat {
  return compileAutoVisualClaim(claim).format;
}

export function parseAutoVisualClaimV5(
  rawValue: unknown,
  story: HoldoutStoryInput,
): AutoVisualClaimV5 {
  const raw = record(rawValue) as RawV5Claim;
  const warnings: string[] = [];
const roleResult = guardExplanatoryRole(inferRole(raw, story), raw, story);
const role = roleResult.role;
if (roleResult.warning) warnings.push(roleResult.warning);
  const sourceCertainty = inferSourceCertainty(story);
  const requestedCertainty = normalizedEnum<VisualCertainty>(
    raw.certainty,
    CERTAINTIES,
    sourceCertainty,
  );
  const certaintyResult = guardedCertainty(requestedCertainty, sourceCertainty);
  if (certaintyResult.warning) warnings.push(certaintyResult.warning);
  const requestedMapping = normalizedEnum<VisualMappingMode>(
    raw.mapping_mode,
    MAPPING_MODES,
    'literal',
  );
  const mappingResult = guardedMappingMode(requestedMapping, role);
  if (mappingResult.warning) warnings.push(mappingResult.warning);

  const metricRaw = record(raw.metric) as RawMetric;
  const direction = inferMetricDirection(metricRaw, story);
  const metricNeeded = role === 'quantitative_result' || role === 'benchmark_comparison';
  const metric: VisualMetricSemantics | null = metricNeeded
    ? {
        direction,
        comparisonTarget: inferComparisonTarget(metricRaw, story),
        baselineLabel: clean(metricRaw.baseline_label, 34),
        resultLabel: clean(metricRaw.result_label, 34),
      }
    : null;

  const rawIdentity = clean(raw.identity, 180);
const titleIdentity = clean(story.title, 180);
const identity =
  rawIdentity.length >= 8
    ? rawIdentity
    : titleIdentity.length >= 8
      ? titleIdentity
      : clean(story.summary, 180);
if (rawIdentity && rawIdentity.length < 8 && identity !== rawIdentity) {
  warnings.push('identity_expanded_from_story_title');
}
  const change = clean(raw.change, 180) || story.summary.slice(0, 180);
  const visualDriver =
    clean(raw.visual_driver, 220) ||
    (role === 'benchmark_comparison'
      ? 'the evaluation places the reported result beside its named comparison target'
      : role === 'quantitative_result'
        ? 'the reported baseline is placed beside the measured result with the correct direction'
        : role === 'uncertainty_announcement'
          ? 'the current confirmed state is separated from the explicitly expected future state'
          : story.summary.slice(0, 220));
  const visibleOutcome =
    clean(raw.visible_outcome, 220) || (story.why ?? story.takeaway ?? story.summary).slice(0, 220);
  const rawCoreClaim =
    clean(raw.core_claim, 240) || `${visualDriver.slice(0, 105)}; ${visibleOutcome.slice(0, 120)}`;
  const guardedCore = guardCoreClaim(
    rawCoreClaim,
    identity,
    change,
    visibleOutcome,
    certaintyResult.certainty,
  );
  if (guardedCore.warning) warnings.push(guardedCore.warning);

  const rawComparison = record(raw.comparison);
  const comparison =
    clean(rawComparison.left, 180) && clean(rawComparison.right, 180)
      ? {
          left: clean(rawComparison.left, 180),
          right: clean(rawComparison.right, 180),
        }
      : defaultComparison(role, story, metric, change, visibleOutcome);
  const labels = labelsFromRaw(raw);
  const rawGrammar = record(raw.grammar) as RawGrammar;

  const baseRaw: Record<string, unknown> = {
    story_id: story.revision_item_id,
    identity,
    change,
    mechanism: visualDriver,
    primary_outcome: visibleOutcome,
    core_claim: guardedCore.coreClaim,
    primary_evidence: roleEvidence(role, raw),
    outcome_kind:
      certaintyResult.certainty === 'planned' ||
      certaintyResult.certainty === 'expected' ||
      certaintyResult.certainty === 'uncertain'
        ? 'uncertainty'
        : clean(record(rawValue).outcome_kind, 40) || 'tradeoff',
    labels,
    quantitative_facts: Array.isArray(raw.quantitative_facts) ? raw.quantitative_facts : [],
    states: Array.isArray(raw.states) ? raw.states : [],
    comparison,
    layers: Array.isArray(raw.layers) ? raw.layers : [],
    routing: raw.routing ?? null,
    forbidden_contradictions: Array.isArray(raw.forbidden_contradictions)
      ? raw.forbidden_contradictions
      : [],
    grammar: {
      context_glyph: rawGrammar.context_glyph,
      mechanism_glyph: rawGrammar.mechanism_glyph,
      outcome_glyph: rawGrammar.outcome_glyph,
      branch_glyphs: rawGrammar.branch_glyphs,
      relation: rawGrammar.relation,
      outcome_signal:
        certaintyResult.certainty === 'planned' ||
        certaintyResult.certainty === 'expected' ||
        certaintyResult.certainty === 'uncertain'
          ? 'uncertain'
          : rawGrammar.outcome_signal,
      human_behavior: rawGrammar.human_behavior,
    },
  };

  let base = parseAutoVisualClaim(baseRaw, story);
  const format = formatForClaim(base);
  base = {
    ...base,
    claim: {
      ...base.claim,
      overlayDirectives: overlayDirectivesForLabels(labels, format),
    },
    extractionWarnings: [...base.extractionWarnings, ...warnings],
  };

  return {
    ...base,
    semantics: {
      explanatoryRole: role,
      certainty: certaintyResult.certainty,
      mappingMode: mappingResult.mode,
      visualDriver,
      metric,
      requiredVisibleDelta: clean(raw.required_visible_delta, 180),
      sourceGuardTerms: sourceGuardTerms(story),
    },
  };
}

export function validateAutoVisualClaimV5(value: AutoVisualClaimV5): string[] {
  const issues: string[] = [];
  const semantics = value.semantics;
  if (!ROLES.has(semantics.explanatoryRole)) issues.push('invalid_explanatory_role');
  if (!CERTAINTIES.has(semantics.certainty)) issues.push('invalid_certainty');
  if (!MAPPING_MODES.has(semantics.mappingMode)) issues.push('invalid_mapping_mode');
  if (semantics.visualDriver.length < 12) issues.push('visual_driver_too_short');

  if (
    semantics.explanatoryRole === 'quantitative_result' ||
    semantics.explanatoryRole === 'benchmark_comparison'
  ) {
    if (!semantics.metric) issues.push('metric_required');
    if (!semantics.metric || semantics.metric.direction === 'neutral') {
      issues.push('metric_direction_required');
    }
    if (!value.claim.quantitativeFacts?.length) issues.push('quantitative_facts_required');
  }
  if (
    semantics.explanatoryRole === 'benchmark_comparison' &&
    !semantics.metric?.comparisonTarget
  ) {
    issues.push('benchmark_comparison_target_required');
  }
  if (
    semantics.explanatoryRole === 'uncertainty_announcement' &&
    !['planned', 'expected', 'claimed', 'reported', 'uncertain'].includes(semantics.certainty)
  ) {
    issues.push('announcement_certainty_not_guarded');
  }
  if (
    ['planned', 'expected', 'claimed', 'reported', 'uncertain'].includes(semantics.certainty) &&
    !/\b(expected|planned|prepares?|set to|aims?|reported|claims?|may|could|preview)\b/i.test(
      value.claim.coreClaim,
    )
  ) {
    issues.push('core_claim_certainty_missing');
  }
  if (
    semantics.mappingMode === 'editorial_analogy' &&
    !['causal_mechanism', 'policy_control', 'capability_access'].includes(
      semantics.explanatoryRole,
    )
  ) {
    issues.push('analogy_not_allowed_for_role');
  }
  if (
    semantics.explanatoryRole === 'state_transition' &&
    value.claim.states &&
    value.claim.states.length >= 2 &&
    !semantics.requiredVisibleDelta
  ) {
    issues.push('state_delta_required');
  }
  return issues;
}

export type VisualRenderModeV5 =
  | 'deterministic_literal'
  | 'generated_editorial_analogy'
  | 'generated_reference_sequence'
  | 'generated_identity_action_pair';

export function selectVisualRenderModeV5(value: AutoVisualClaimV5): VisualRenderModeV5 {
  const { explanatoryRole: role, mappingMode } = value.semantics;
  if (role === 'state_transition') {
    return value.grammar.humanBehavior
      ? 'generated_reference_sequence'
      : 'deterministic_literal';
  }
  if (role === 'causal_mechanism' && value.grammar.humanBehavior) {
    return 'generated_identity_action_pair';
  }
  if (mappingMode === 'editorial_analogy') return 'generated_editorial_analogy';
  return 'deterministic_literal';
}

export function compileAutoVisualClaimV5(value: AutoVisualClaimV5): VisualPlan {
  const issues = validateAutoVisualClaimV5(value);
  if (issues.length) {
    throw new Error(`Invalid VisualClaim v5 ${value.storyId}: ${issues.join(', ')}`);
  }
  return compileAutoVisualClaim(value);
}

export function visualClaimV5ExtractionPrompt(stories: readonly HoldoutStoryInput[]): string {
  const template = {
    claims: [
      {
        story_id: 'copy exactly',
        explanatory_role: 'quantitative_result',
        certainty: 'observed',
        mapping_mode: 'literal',
        identity: 'visible subject/system anchor',
        change: 'one factual change or reported comparison',
        visual_driver: 'the visible operation, comparison, access path, policy gate or state delta; do not invent a causal mechanism',
        visible_outcome: 'one source-grounded visible result',
        core_claim: 'one source-grounded proposition preserving certainty',
        metric: {
          direction: 'decrease',
          comparison_target: 'exact named target when present',
          baseline_label: 'short baseline label',
          result_label: 'short result label',
        },
        labels: ['MAX THREE SHORT EXACT LABELS'],
        quantitative_facts: [{ label: 'EXACT LABEL', value: 'EXACT SOURCE VALUE' }],
        states: [],
        comparison: null,
        layers: [],
        routing: null,
        required_visible_delta: '',
        forbidden_contradictions: ['one concrete unsupported implication to avoid'],
        grammar: {
          context_glyph: 'model_chip',
          mechanism_glyph: 'workflow',
          outcome_glyph: 'gauge',
          branch_glyphs: null,
          relation: 'compare',
          outcome_signal: 'lower_tokens',
          human_behavior: false,
        },
      },
    ],
  };
  return [
    'You are extracting VisualClaim v5 for AI Today Brief. Every image is displayed beside its headline.',
    'Return one core visual proposition per story. The original story is the only factual source.',
    '',
    'Choose explanatory_role carefully:',
    '- causal_mechanism: the story explicitly explains why one action causes one result;',
    '- architecture_transformation: layers/components are removed, lowered, isolated, compressed or transformed;',
    '- state_transition: a visible before/interruption/after delta is central;',
    '- quantitative_result: a measured numeric change is central, without inventing why it happened;',
    '- benchmark_comparison: an evaluation compares a model/result with a named target; the benchmark is context, not a causal mechanism;',
    '- capability_access: a release gives users or agents a new bounded capability or access path;',
    '- policy_control: an external policy layer allows or blocks a tool/action;',
    '- uncertainty_announcement: a planned, expected, claimed or previewed future state is the story.',
    '',
    'CERTAINTY IS A HARD CONTRACT. Preserve words such as prepares, expected, aims, reports, claims, preview, may and up to. Never turn expected into available, claimed into proven, or reported into guaranteed.',
    'For quantitative_result and benchmark_comparison, visual_driver is the comparison itself. Do not invent an architecture or optimization mechanism unless the story states it.',
    'metric.direction must be increase, decrease, higher_is_better, lower_is_better or neutral. Preserve the named comparison target, for example “half the cost of Opus”, not merely “$4.76”.',
    'mapping_mode may be editorial_analogy only for causal_mechanism, policy_control or capability_access, and only when a concrete one-to-one physical analogy can show the same action and outcome. Otherwise use literal.',
    'For state_transition, required_visible_delta must name the physical difference between states. Similar repeated scenes with only different labels are invalid.',
    'Use at most three exact deterministic labels. No invented numbers, UI strings, company logos or implementation details.',
    'Return JSON only with every key in OUTPUT_TEMPLATE. Use null/[] when fields are not applicable.',
    '',
    `OUTPUT_TEMPLATE=${JSON.stringify(template)}`,
    `STORIES=${JSON.stringify(
      stories.map((story) => ({
        story_id: story.revision_item_id,
        headline: story.title,
        summary: story.summary,
        why: story.why,
        practical: story.practical,
        takeaway: story.takeaway,
      })),
    )}`,
  ].join('\n');
}

export function analogyPromptV5(value: AutoVisualClaimV5): string {
  return [
    'Create one cinematic editorial analogy for later deterministic compositing.',
    `Headline context: ${value.claim.identity}.`,
    `The analogy must visibly map this source-grounded driver: ${value.semantics.visualDriver}.`,
    `It must visibly produce this result: ${value.claim.primaryOutcome}.`,
    `Required mapping: ${value.claim.coreClaim}.`,
    'Use one coherent physical environment and one focal action. The physical cause and the physical result must both be visible in the same frame.',
    'Do not depict implementation details absent from the source. Do not imply stronger certainty than the headline.',
    'Premium technology-magazine cinematography, believable materials and physics, dramatic but restrained light, strong silhouette, editorial tension, wide 16:9 composition.',
    'Absolutely no text, letters, words, numbers, code, UI copy, logos, labels, watermarks, arrows, diagrams or infographic panels.',
  ].join(' ');
}

export function v5Format(value: AutoVisualClaimV5): VisualFormat {
  return compileAutoVisualClaimV5(value).format;
}

export type V5GlyphContract = {
  contextGlyph: VisualGlyph;
  mechanismGlyph: VisualGlyph;
  outcomeGlyph: VisualGlyph;
  relation: VisualRelation;
  outcomeSignal: VisualOutcomeSignal;
};
