export const WEEKLY_VISUAL_POLICY = {
  displayContext: 'always_with_headline',
  objective: 'one_core_claim',
  style: 'cinematic_explanatory_editorial',
  overlayGroups: { min: 0, max: 3 },
  sourceReferenceMode: 'stylized_only',
  weights: {
    instantMeaning: 0.45,
    visualBeauty: 0.3,
    brandConsistency: 0.15,
    originality: 0.1,
  },
  budget: {
    maxUsd: 0.1,
    maxDurationMs: 60_000,
    maxCandidates: 2,
    maxVisionCalls: 2,
    maxFullRegenerations: 1,
  },
} as const;

export const VISUAL_FORMATS = [
  'cinematic_single',
  'cinematic_sequence',
  'cinematic_split',
  'cinematic_cutaway',
  'cinematic_data_contrast',
  'cinematic_routing',
] as const;

export type VisualFormat = (typeof VISUAL_FORMATS)[number];

export type PrimaryVisualEvidence =
  | 'physical_action'
  | 'temporal_change'
  | 'architecture_change'
  | 'counterfactual_comparison'
  | 'quantitative_difference'
  | 'task_routing';

export type VisualOutcomeKind = 'benefit' | 'harm' | 'tradeoff' | 'uncertainty';

export interface QuantitativeVisualFact {
  label: string;
  value: string;
  sourceClaim?: string;
}

export interface VisualRouteBranch {
  label: string;
  destination: string;
  visibleOutcome: string;
}

export interface VisualRoutingSpec {
  source: string;
  branches: VisualRouteBranch[];
}

export interface ApprovedOverlayDirective {
  text: string;
  /** Exact region ID from the chosen layout, e.g. state-2, remaining-core or route-a. */
  regionId?: string;
  importance?: 'primary' | 'secondary';
}

export interface VisualClaim {
  storyId: string;
  /** Headline supplies named identity; this is the visible subject/system anchor. */
  identity: string;
  /** One factual change, not a list of story details. */
  change: string;
  /** One visible causal action or process. */
  mechanism: string;
  /** One visible result. */
  primaryOutcome: string;
  /** The single proposition the headline + image pair must communicate. */
  coreClaim: string;
  primaryEvidence: PrimaryVisualEvidence;
  outcomeKind: VisualOutcomeKind;
  /** Preferred: exact deterministic overlay placement. */
  overlayDirectives?: ApprovedOverlayDirective[];
  /** Compatibility/fallback when an exact region has not been planned yet. */
  approvedLabels?: string[];
  quantitativeFacts?: QuantitativeVisualFact[];
  /** Two or three states for a temporal claim. */
  states?: string[];
  /** Two causal sides for a comparison claim. */
  comparison?: { left: string; right: string };
  /** Two or three meaningful layers for an architecture claim. */
  layers?: string[];
  /** One source routed into two visibly different specialist destinations. */
  routing?: VisualRoutingSpec;
  /** Concrete contradictions the pixels must not imply. */
  forbiddenContradictions?: string[];
  /** Optional owner/editor selection; still validated against the claim evidence. */
  preferredFormat?: VisualFormat;
}

export interface NormalizedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type VisualRegionRole = 'context' | 'mechanism' | 'outcome' | 'contrast';

export interface VisualRegion {
  id: string;
  bounds: NormalizedBounds;
  role: VisualRegionRole;
  description: string;
}

export type VisualTransitionType =
  | 'flow'
  | 'state_change'
  | 'contrast'
  | 'reveal'
  | 'branch';

export interface VisualTransition {
  from: string;
  to: string;
  type: VisualTransitionType;
}

export interface OverlayGroup {
  id: string;
  text: string;
  regionId?: string;
  importance: 'primary' | 'secondary';
  source: 'approved_claim';
}

export interface RenderUnit {
  id: string;
  regionId: string;
  assetRequest: string;
  prompt: string;
  continuityKey: string;
  referenceFrom?: string;
  generatedTextAllowed: false;
  infographicLayoutAllowed: false;
}

export type RenderStrategy =
  | 'one_asset'
  | 'one_asset_plus_vector'
  | 'reference_sequence'
  | 'reference_split';

export interface VisualExecutionBudget {
  candidateCount: number;
  imageCalls: number;
  visionCalls: number;
  fullRegenerations: number;
  estimatedUsd: number;
  estimatedDurationMs: number;
  withinPolicy: boolean;
}

export interface VisualPlan {
  policyId: 'weekly-visual-compiler-v0';
  claim: VisualClaim;
  format: VisualFormat;
  renderStrategy: RenderStrategy;
  regions: VisualRegion[];
  transitions: VisualTransition[];
  overlays: OverlayGroup[];
  renderUnits: RenderUnit[];
  pixelAssertions: string[];
  forbiddenContradictions: string[];
  execution: VisualExecutionBudget;
}

export interface VisualCostAssumptions {
  imageCallUsd: number;
  visionCallUsd: number;
  imageCallDurationMs: number;
  visionCallDurationMs: number;
}

export const DEFAULT_VISUAL_COST_ASSUMPTIONS: VisualCostAssumptions = {
  imageCallUsd: 0.015,
  visionCallUsd: 0.01,
  imageCallDurationMs: 9_000,
  visionCallDurationMs: 6_000,
};

function clean(value: string, maxLength: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of values) {
    const value = clean(raw, 48);
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

export function formatSupportsEvidence(
  format: VisualFormat,
  evidence: PrimaryVisualEvidence,
): boolean {
  switch (evidence) {
    case 'temporal_change':
      return format === 'cinematic_sequence';
    case 'architecture_change':
      return format === 'cinematic_cutaway';
    case 'counterfactual_comparison':
      return format === 'cinematic_split';
    case 'quantitative_difference':
      return format === 'cinematic_data_contrast';
    case 'task_routing':
      return format === 'cinematic_routing';
    case 'physical_action':
      return format === 'cinematic_single';
  }
}

export function selectVisualFormat(claim: VisualClaim): VisualFormat {
  if (
    claim.preferredFormat &&
    formatSupportsEvidence(claim.preferredFormat, claim.primaryEvidence)
  ) {
    return claim.preferredFormat;
  }
  switch (claim.primaryEvidence) {
    case 'temporal_change':
      return 'cinematic_sequence';
    case 'architecture_change':
      return 'cinematic_cutaway';
    case 'counterfactual_comparison':
      return 'cinematic_split';
    case 'quantitative_difference':
      return 'cinematic_data_contrast';
    case 'task_routing':
      return 'cinematic_routing';
    case 'physical_action':
      return 'cinematic_single';
  }
}

function region(
  id: string,
  bounds: NormalizedBounds,
  role: VisualRegionRole,
  description: string,
): VisualRegion {
  return { id, bounds, role, description: clean(description, 220) };
}

function twoRouteBranches(claim: VisualClaim): [VisualRouteBranch, VisualRouteBranch] {
  const branches = claim.routing?.branches.slice(0, 2) ?? [];
  const left = branches[0] ?? {
    label: 'ROUTE A',
    destination: 'first specialist destination',
    visibleOutcome: claim.primaryOutcome,
  };
  const right = branches[1] ?? {
    label: 'ROUTE B',
    destination: 'second specialist destination',
    visibleOutcome: claim.primaryOutcome,
  };
  return [left, right];
}

export function buildVisualRegions(claim: VisualClaim, format: VisualFormat): VisualRegion[] {
  switch (format) {
    case 'cinematic_sequence': {
      const states = unique(
        claim.states?.length
          ? claim.states.slice(0, 3)
          : [claim.identity, claim.change, claim.primaryOutcome],
      );
      const padded = [...states];
      while (padded.length < 3) padded.push(claim.primaryOutcome);
      return [
        region(
          'state-1',
          { x: 0.03, y: 0.09, width: 0.29, height: 0.78 },
          'context',
          padded[0]!,
        ),
        region(
          'state-2',
          { x: 0.355, y: 0.09, width: 0.29, height: 0.78 },
          'mechanism',
          padded[1]!,
        ),
        region(
          'state-3',
          { x: 0.68, y: 0.09, width: 0.29, height: 0.78 },
          'outcome',
          padded[2]!,
        ),
      ];
    }
    case 'cinematic_split': {
      const left = claim.comparison?.left ?? `${claim.identity} before the change`;
      const right = claim.comparison?.right ?? claim.primaryOutcome;
      return [
        region(
          'left',
          { x: 0.03, y: 0.08, width: 0.455, height: 0.8 },
          'contrast',
          left,
        ),
        region(
          'right',
          { x: 0.515, y: 0.08, width: 0.455, height: 0.8 },
          'outcome',
          right,
        ),
      ];
    }
    case 'cinematic_cutaway': {
      const layers = unique(
        claim.layers?.length ? claim.layers.slice(0, 3) : [claim.identity, claim.change],
      );
      return [
        region(
          'full-system',
          { x: 0.04, y: 0.1, width: 0.41, height: 0.76 },
          'context',
          layers[0] ?? claim.identity,
        ),
        region(
          'removed-layers',
          { x: 0.455, y: 0.2, width: 0.16, height: 0.56 },
          'mechanism',
          layers[1] ?? claim.change,
        ),
        region(
          'remaining-core',
          { x: 0.62, y: 0.1, width: 0.34, height: 0.76 },
          'outcome',
          layers[2] ?? claim.primaryOutcome,
        ),
      ];
    }
    case 'cinematic_data_contrast': {
      const left = claim.comparison?.left ?? 'small baseline workload';
      const right = claim.comparison?.right ?? claim.mechanism;
      return [
        region(
          'baseline',
          { x: 0.04, y: 0.1, width: 0.4, height: 0.76 },
          'context',
          left,
        ),
        region(
          'amplified',
          { x: 0.56, y: 0.1, width: 0.4, height: 0.76 },
          'outcome',
          right,
        ),
      ];
    }
    case 'cinematic_routing': {
      const [left, right] = twoRouteBranches(claim);
      return [
        region(
          'route-source',
          { x: 0.38, y: 0.34, width: 0.24, height: 0.32 },
          'mechanism',
          claim.routing?.source ?? claim.mechanism,
        ),
        region(
          'route-a',
          { x: 0.03, y: 0.09, width: 0.3, height: 0.78 },
          'outcome',
          `${left.destination}: ${left.visibleOutcome}`,
        ),
        region(
          'route-b',
          { x: 0.67, y: 0.09, width: 0.3, height: 0.78 },
          'outcome',
          `${right.destination}: ${right.visibleOutcome}`,
        ),
      ];
    }
    case 'cinematic_single':
      return [
        region(
          'hero',
          { x: 0.04, y: 0.08, width: 0.92, height: 0.82 },
          'mechanism',
          `${claim.mechanism} visibly produces ${claim.primaryOutcome}`,
        ),
      ];
  }
}

export function buildVisualTransitions(format: VisualFormat): VisualTransition[] {
  switch (format) {
    case 'cinematic_sequence':
      return [
        { from: 'state-1', to: 'state-2', type: 'state_change' },
        { from: 'state-2', to: 'state-3', type: 'state_change' },
      ];
    case 'cinematic_split':
      return [{ from: 'left', to: 'right', type: 'contrast' }];
    case 'cinematic_data_contrast':
      return [{ from: 'baseline', to: 'amplified', type: 'contrast' }];
    case 'cinematic_cutaway':
      return [
        { from: 'full-system', to: 'removed-layers', type: 'reveal' },
        { from: 'removed-layers', to: 'remaining-core', type: 'flow' },
      ];
    case 'cinematic_routing':
      return [
        { from: 'route-source', to: 'route-a', type: 'branch' },
        { from: 'route-source', to: 'route-b', type: 'branch' },
      ];
    case 'cinematic_single':
      return [];
  }
}

export function normalizeApprovedLabels(claim: VisualClaim): string[] {
  if (claim.overlayDirectives?.length) {
    return unique(claim.overlayDirectives.map((directive) => directive.text)).slice(
      0,
      WEEKLY_VISUAL_POLICY.overlayGroups.max,
    );
  }
  const explicit = claim.approvedLabels ?? [];
  const quantitative = (claim.quantitativeFacts ?? []).map((fact) =>
    clean(`${fact.label} ${fact.value}`, 48),
  );
  const stateFallback = claim.primaryEvidence === 'temporal_change' ? claim.states ?? [] : [];
  const routingFallback =
    claim.primaryEvidence === 'task_routing'
      ? claim.routing?.branches.map((branch) => branch.label) ?? []
      : [];
  return unique([...explicit, ...quantitative, ...stateFallback, ...routingFallback]).slice(
    0,
    WEEKLY_VISUAL_POLICY.overlayGroups.max,
  );
}

export function buildOverlayGroups(
  claim: VisualClaim,
  regions: VisualRegion[],
): OverlayGroup[] {
  if (claim.overlayDirectives?.length) {
    return claim.overlayDirectives
      .slice(0, WEEKLY_VISUAL_POLICY.overlayGroups.max)
      .map((directive, index) => ({
        id: `overlay-${index + 1}`,
        text: clean(directive.text, 48),
        regionId: directive.regionId,
        importance: directive.importance ?? (index === 0 ? 'primary' : 'secondary'),
        source: 'approved_claim',
      }));
  }
  const labels = normalizeApprovedLabels(claim);
  return labels.map((text, index) => ({
    id: `overlay-${index + 1}`,
    text,
    regionId: regions[Math.min(index, regions.length - 1)]?.id,
    importance: index === 0 ? 'primary' : 'secondary',
    source: 'approved_claim',
  }));
}

function assetPrompt(input: {
  claim: VisualClaim;
  region: VisualRegion;
  format: VisualFormat;
  continuityKey: string;
}): string {
  return [
    'Create one clean cinematic visual asset for later editorial compositing.',
    `Visible subject/system: ${clean(input.claim.identity, 120)}.`,
    `This asset must show: ${clean(input.region.description, 220)}.`,
    `The physical action must support this mechanism: ${clean(input.claim.mechanism, 180)}.`,
    `The visible result must remain compatible with: ${clean(input.claim.primaryOutcome, 180)}.`,
    'Premium technology-magazine cinematography, believable materials and physics, strong silhouette, dramatic available light, restrained modern grade, editorial tension, wide horizontal composition.',
    `Continuity key: ${input.continuityKey}. Preserve the same subject design, camera language, environment, scale and material identity across related assets.`,
    'Asset only. Do not create an infographic or finished card layout.',
    'Absolutely no text, letters, words, numbers, symbols, logos, watermarks, captions, labels, UI copy, diagrams, arrows, callouts, borders, title bars or panel headings.',
    input.format === 'cinematic_sequence' ||
    input.format === 'cinematic_split' ||
    input.format === 'cinematic_routing'
      ? 'Leave stable margins so this asset can sit beside continuity-matched companion assets.'
      : 'Leave calm negative space for deterministic labels added after rendering.',
  ].join(' ');
}

function renderStrategyFor(format: VisualFormat): RenderStrategy {
  switch (format) {
    case 'cinematic_sequence':
      return 'reference_sequence';
    case 'cinematic_split':
    case 'cinematic_routing':
      return 'reference_split';
    case 'cinematic_cutaway':
    case 'cinematic_data_contrast':
      return 'one_asset_plus_vector';
    case 'cinematic_single':
      return 'one_asset';
  }
}

export function buildRenderUnits(
  claim: VisualClaim,
  format: VisualFormat,
  regions: VisualRegion[],
): RenderUnit[] {
  const continuityKey = clean(`${claim.storyId}:${claim.identity}`, 100);
  const renderRegions =
    format === 'cinematic_cutaway'
      ? regions.filter((candidate) => candidate.id !== 'removed-layers')
      : format === 'cinematic_routing'
        ? regions.filter((candidate) => candidate.id !== 'route-source')
        : regions;
  return renderRegions.map((candidate, index) => ({
    id: `asset-${index + 1}`,
    regionId: candidate.id,
    assetRequest: candidate.description,
    prompt: assetPrompt({ claim, region: candidate, format, continuityKey }),
    continuityKey,
    referenceFrom:
      index > 0 &&
      (format === 'cinematic_sequence' ||
        format === 'cinematic_split' ||
        format === 'cinematic_routing')
        ? 'asset-1'
        : undefined,
    generatedTextAllowed: false,
    infographicLayoutAllowed: false,
  }));
}

export function planVisualExecution(
  format: VisualFormat,
  assumptions: VisualCostAssumptions = DEFAULT_VISUAL_COST_ASSUMPTIONS,
): VisualExecutionBudget {
  const callPlan: Record<
    VisualFormat,
    Omit<VisualExecutionBudget, 'estimatedUsd' | 'estimatedDurationMs' | 'withinPolicy'>
  > = {
    cinematic_single: {
      candidateCount: 2,
      imageCalls: 2,
      visionCalls: 2,
      fullRegenerations: 0,
    },
    cinematic_data_contrast: {
      candidateCount: 2,
      imageCalls: 2,
      visionCalls: 2,
      fullRegenerations: 0,
    },
    cinematic_cutaway: {
      candidateCount: 2,
      imageCalls: 2,
      visionCalls: 2,
      fullRegenerations: 0,
    },
    cinematic_split: {
      candidateCount: 1,
      imageCalls: 2,
      visionCalls: 2,
      fullRegenerations: 0,
    },
    cinematic_routing: {
      candidateCount: 1,
      imageCalls: 2,
      visionCalls: 2,
      fullRegenerations: 0,
    },
    cinematic_sequence: {
      candidateCount: 1,
      imageCalls: 3,
      visionCalls: 2,
      fullRegenerations: 0,
    },
  };
  const plan = callPlan[format];
  const estimatedUsd =
    plan.imageCalls * assumptions.imageCallUsd + plan.visionCalls * assumptions.visionCallUsd;
  // Related assets render concurrently where possible; a sequence needs one reference wave.
  const imageWaves = format === 'cinematic_sequence' ? 2 : 1;
  const estimatedDurationMs =
    imageWaves * assumptions.imageCallDurationMs +
    plan.visionCalls * assumptions.visionCallDurationMs +
    5_000;
  return {
    ...plan,
    estimatedUsd,
    estimatedDurationMs,
    withinPolicy:
      estimatedUsd <= WEEKLY_VISUAL_POLICY.budget.maxUsd &&
      estimatedDurationMs <= WEEKLY_VISUAL_POLICY.budget.maxDurationMs &&
      plan.candidateCount <= WEEKLY_VISUAL_POLICY.budget.maxCandidates &&
      plan.visionCalls <= WEEKLY_VISUAL_POLICY.budget.maxVisionCalls &&
      plan.fullRegenerations <= WEEKLY_VISUAL_POLICY.budget.maxFullRegenerations,
  };
}

export function compileVisualPlan(
  claim: VisualClaim,
  assumptions: VisualCostAssumptions = DEFAULT_VISUAL_COST_ASSUMPTIONS,
): VisualPlan {
  const format = selectVisualFormat(claim);
  const regions = buildVisualRegions(claim, format);
  return {
    policyId: 'weekly-visual-compiler-v0',
    claim,
    format,
    renderStrategy: renderStrategyFor(format),
    regions,
    transitions: buildVisualTransitions(format),
    overlays: buildOverlayGroups(claim, regions),
    renderUnits: buildRenderUnits(claim, format, regions),
    pixelAssertions: [
      `Visible mechanism: ${clean(claim.mechanism, 180)}`,
      `Visible outcome: ${clean(claim.primaryOutcome, 180)}`,
      `One causal claim: ${clean(claim.coreClaim, 220)}`,
    ],
    forbiddenContradictions: unique(claim.forbiddenContradictions ?? []),
    execution: planVisualExecution(format, assumptions),
  };
}

export type VisualPlanIssue =
  | 'format_evidence_mismatch'
  | 'too_many_overlays'
  | 'overlay_region_missing'
  | 'render_unit_allows_text'
  | 'render_unit_allows_infographic'
  | 'budget_exceeded';

export function validateVisualPlan(plan: VisualPlan): VisualPlanIssue[] {
  const issues: VisualPlanIssue[] = [];
  if (!formatSupportsEvidence(plan.format, plan.claim.primaryEvidence)) {
    issues.push('format_evidence_mismatch');
  }
  if (plan.overlays.length > WEEKLY_VISUAL_POLICY.overlayGroups.max) {
    issues.push('too_many_overlays');
  }
  const regionIds = new Set(plan.regions.map((region) => region.id));
  if (plan.overlays.some((overlay) => overlay.regionId && !regionIds.has(overlay.regionId))) {
    issues.push('overlay_region_missing');
  }
  if (plan.renderUnits.some((unit) => unit.generatedTextAllowed !== false)) {
    issues.push('render_unit_allows_text');
  }
  if (plan.renderUnits.some((unit) => unit.infographicLayoutAllowed !== false)) {
    issues.push('render_unit_allows_infographic');
  }
  if (!plan.execution.withinPolicy) issues.push('budget_exceeded');
  return issues;
}

export type PixelGateFailureCode =
  | 'identity_missing'
  | 'mechanism_missing'
  | 'outcome_missing'
  | 'causal_relation_missing'
  | 'contradictory_action'
  | 'generated_text'
  | 'subject_inconsistent';

export interface PixelGateEvidence {
  identityVisible: boolean;
  mechanismVisible: boolean;
  outcomeVisible: boolean;
  causalRelationVisible: boolean;
  contradictoryAction: boolean;
  generatedTextPresent: boolean;
  subjectConsistent: boolean;
}

export interface GateResult<Code extends string> {
  passed: boolean;
  failures: Code[];
}

export function evaluatePixelGate(
  evidence: PixelGateEvidence,
): GateResult<PixelGateFailureCode> {
  const failures: PixelGateFailureCode[] = [];
  if (!evidence.identityVisible) failures.push('identity_missing');
  if (!evidence.mechanismVisible) failures.push('mechanism_missing');
  if (!evidence.outcomeVisible) failures.push('outcome_missing');
  if (!evidence.causalRelationVisible) failures.push('causal_relation_missing');
  if (evidence.contradictoryAction) failures.push('contradictory_action');
  if (evidence.generatedTextPresent) failures.push('generated_text');
  if (!evidence.subjectConsistent) failures.push('subject_inconsistent');
  return { passed: failures.length === 0, failures };
}

export type FinalGateFailureCode =
  | PixelGateFailureCode
  | 'labels_not_approved'
  | 'overlay_contradicts_pixels'
  | 'headline_pair_unclear'
  | 'thumbnail_unreadable';

export interface FinalGateEvidence extends PixelGateEvidence {
  labelsApprovedAndExact: boolean;
  overlaysSupportedByPixels: boolean;
  headlineImagePairUnderstood: boolean;
  thumbnailReadable: boolean;
}

export function evaluateFinalGate(
  evidence: FinalGateEvidence,
): GateResult<FinalGateFailureCode> {
  const pixel = evaluatePixelGate(evidence);
  const failures: FinalGateFailureCode[] = [...pixel.failures];
  if (!evidence.labelsApprovedAndExact) failures.push('labels_not_approved');
  if (!evidence.overlaysSupportedByPixels) failures.push('overlay_contradicts_pixels');
  if (!evidence.headlineImagePairUnderstood) failures.push('headline_pair_unclear');
  if (!evidence.thumbnailReadable) failures.push('thumbnail_unreadable');
  return { passed: failures.length === 0, failures };
}

export interface VisualQualityScores {
  instantMeaning: number;
  visualBeauty: number;
  brandConsistency: number;
  originality: number;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function weightedVisualScore(scores: VisualQualityScores): number {
  const weights = WEEKLY_VISUAL_POLICY.weights;
  return (
    clampScore(scores.instantMeaning) * weights.instantMeaning +
    clampScore(scores.visualBeauty) * weights.visualBeauty +
    clampScore(scores.brandConsistency) * weights.brandConsistency +
    clampScore(scores.originality) * weights.originality
  );
}

export interface RankedVisualCandidate {
  eligible: boolean;
  weightedScore: number;
  finalGate: GateResult<FinalGateFailureCode>;
}

export function rankVisualCandidate(
  scores: VisualQualityScores,
  evidence: FinalGateEvidence,
): RankedVisualCandidate {
  const finalGate = evaluateFinalGate(evidence);
  return {
    eligible: finalGate.passed,
    weightedScore: weightedVisualScore(scores),
    finalGate,
  };
}

export type VisualRepairMode =
  | 'none'
  | 'recompose_overlays'
  | 'edit_generated_text'
  | 'regenerate_failed_asset'
  | 'replan_visual_claim'
  | 'deterministic_fallback';

export function chooseVisualRepair(
  failures: readonly FinalGateFailureCode[],
  remainingFullRegenerations: number = WEEKLY_VISUAL_POLICY.budget.maxFullRegenerations,
): VisualRepairMode {
  if (failures.length === 0) return 'none';
  if (
    failures.some(
      (failure) =>
        failure === 'contradictory_action' ||
        failure === 'overlay_contradicts_pixels' ||
        failure === 'headline_pair_unclear',
    )
  ) {
    return remainingFullRegenerations > 0 ? 'replan_visual_claim' : 'deterministic_fallback';
  }
  if (
    failures.some(
      (failure) =>
        failure === 'identity_missing' ||
        failure === 'mechanism_missing' ||
        failure === 'outcome_missing' ||
        failure === 'causal_relation_missing' ||
        failure === 'subject_inconsistent',
    )
  ) {
    return 'regenerate_failed_asset';
  }
  if (failures.every((failure) => failure === 'generated_text')) {
    return 'edit_generated_text';
  }
  if (
    failures.every(
      (failure) => failure === 'labels_not_approved' || failure === 'thumbnail_unreadable',
    )
  ) {
    return 'recompose_overlays';
  }
  return 'deterministic_fallback';
}
