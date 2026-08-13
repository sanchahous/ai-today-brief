import {
  compileVisualPlan,
  type ApprovedOverlayDirective,
  type PrimaryVisualEvidence,
  type VisualClaim,
  type VisualFormat,
  type VisualOutcomeKind,
  type VisualPlan,
} from './visual-compiler';

export const VISUAL_GLYPHS = [
  'agent',
  'model_chip',
  'package_box',
  'sandbox',
  'network',
  'internet',
  'shield',
  'lock',
  'key',
  'policy_gate',
  'code_file',
  'code_graph',
  'context_stack',
  'document',
  'database',
  'browser',
  'terminal',
  'tool',
  'workflow',
  'compiler_stack',
  'hardware_chip',
  'local_device',
  'cloud',
  'microphone',
  'waveform',
  'meeting',
  'benchmark',
  'leaderboard',
  'gauge',
  'coins',
  'speedometer',
  'component_grid',
  'human',
  'teacher',
  'student',
  'folder',
  'spreadsheet',
  'camera',
  'maze',
  'checkmark',
  'warning',
] as const;

export type VisualGlyph = (typeof VISUAL_GLYPHS)[number];

export const VISUAL_RELATIONS = [
  'flow',
  'branch',
  'delegate',
  'block',
  'escape',
  'protect',
  'inject',
  'compress',
  'prune',
  'remove',
  'transform',
  'lower',
  'increase',
  'compare',
  'loop',
  'execute',
  'transcribe',
  'compile',
  'inspect',
] as const;

export type VisualRelation = (typeof VISUAL_RELATIONS)[number];

export const VISUAL_OUTCOME_SIGNALS = [
  'success',
  'failure',
  'blocked',
  'escaped',
  'safer',
  'private',
  'local',
  'faster',
  'slower',
  'lower_cost',
  'higher_cost',
  'lower_tokens',
  'higher_tokens',
  'smaller',
  'larger',
  'more_accurate',
  'less_accurate',
  'completed',
  'uncertain',
] as const;

export type VisualOutcomeSignal = (typeof VISUAL_OUTCOME_SIGNALS)[number];

export interface HoldoutStoryInput {
  week_start: string;
  week_end: string;
  rank: number;
  revision_item_id: string;
  title: string;
  summary: string;
  why: string | null;
  practical: string | null;
  takeaway: string | null;
}

export interface VisualGrammar {
  contextGlyph: VisualGlyph;
  mechanismGlyph: VisualGlyph;
  outcomeGlyph: VisualGlyph;
  branchGlyphs: [VisualGlyph, VisualGlyph] | null;
  relation: VisualRelation;
  outcomeSignal: VisualOutcomeSignal;
  humanBehavior: boolean;
}

export interface AutoVisualClaim {
  storyId: string;
  claim: VisualClaim;
  grammar: VisualGrammar;
  extractionWarnings: string[];
}

interface RawQuantitativeFact {
  label?: unknown;
  value?: unknown;
}

interface RawRouteBranch {
  label?: unknown;
  destination?: unknown;
  visibleOutcome?: unknown;
}

interface RawClaimRow {
  story_id?: unknown;
  identity?: unknown;
  change?: unknown;
  mechanism?: unknown;
  primary_outcome?: unknown;
  core_claim?: unknown;
  primary_evidence?: unknown;
  outcome_kind?: unknown;
  labels?: unknown;
  quantitative_facts?: unknown;
  states?: unknown;
  comparison?: unknown;
  layers?: unknown;
  routing?: unknown;
  forbidden_contradictions?: unknown;
  grammar?: unknown;
}

const EVIDENCE = new Set<PrimaryVisualEvidence>([
  'physical_action',
  'temporal_change',
  'architecture_change',
  'counterfactual_comparison',
  'quantitative_difference',
  'task_routing',
]);

const OUTCOME_KINDS = new Set<VisualOutcomeKind>([
  'benefit',
  'harm',
  'tradeoff',
  'uncertainty',
]);

const GLYPHS = new Set<string>(VISUAL_GLYPHS);
const RELATIONS = new Set<string>(VISUAL_RELATIONS);
const SIGNALS = new Set<string>(VISUAL_OUTCOME_SIGNALS);

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => text(entry, maxLength)).filter(Boolean))].slice(
    0,
    maxItems,
  );
}

function glyph(value: unknown, fallback: VisualGlyph): VisualGlyph {
  const normalized = text(value, 40).toLowerCase().replace(/[\s-]+/g, '_');
  return GLYPHS.has(normalized) ? (normalized as VisualGlyph) : fallback;
}

function relation(value: unknown): VisualRelation {
  const normalized = text(value, 40).toLowerCase().replace(/[\s-]+/g, '_');
  return RELATIONS.has(normalized) ? (normalized as VisualRelation) : 'flow';
}

function outcomeSignal(value: unknown, kind: VisualOutcomeKind): VisualOutcomeSignal {
  const normalized = text(value, 40).toLowerCase().replace(/[\s-]+/g, '_');
  if (SIGNALS.has(normalized)) return normalized as VisualOutcomeSignal;
  if (kind === 'harm') return 'failure';
  if (kind === 'uncertainty') return 'uncertain';
  return 'success';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fallbackGlyphs(story: HoldoutStoryInput): [VisualGlyph, VisualGlyph, VisualGlyph] {
  const source = `${story.title} ${story.summary} ${story.why ?? ''}`.toLowerCase();
  const context: VisualGlyph = /browser/.test(source)
    ? 'browser'
    : /terminal|cli|command/.test(source)
      ? 'terminal'
      : /meeting|transcri|whisper|voice/.test(source)
        ? 'meeting'
        : /design|react|component|frontend/.test(source)
          ? 'component_grid'
          : /security|sandbox|exploit|credential|policy/.test(source)
            ? 'sandbox'
            : /compiler|mlir|hardware|verilog/.test(source)
              ? 'compiler_stack'
              : /benchmark|leaderboard|judge/.test(source)
                ? 'benchmark'
                : /local|device|desktop|notebook/.test(source)
                  ? 'local_device'
                  : 'model_chip';
  const mechanism: VisualGlyph = /graph|tree-sitter|dependency/.test(source)
    ? 'code_graph'
    : /proxy|gateway|route|delegate|orchestrat/.test(source)
      ? 'workflow'
      : /policy|block|restrict|isolate/.test(source)
        ? 'policy_gate'
        : /prun|compact|token|context/.test(source)
          ? 'context_stack'
          : /execute|code/.test(source)
            ? 'code_file'
            : /transcri|voice/.test(source)
              ? 'waveform'
              : 'tool';
  const outcome: VisualGlyph = /cost|price|cheap|saving/.test(source)
    ? 'coins'
    : /token/.test(source)
      ? 'gauge'
      : /privacy|credential|safe|security|isolate/.test(source)
        ? 'shield'
        : /internet|external/.test(source)
          ? 'internet'
          : /code|component|compile/.test(source)
            ? 'code_file'
            : /benchmark|leaderboard/.test(source)
              ? 'leaderboard'
              : 'checkmark';
  return [context, mechanism, outcome];
}

function parseEvidence(value: unknown, raw: RawClaimRow): PrimaryVisualEvidence {
  const normalized = text(value, 60).toLowerCase().replace(/[\s-]+/g, '_');
  if (EVIDENCE.has(normalized as PrimaryVisualEvidence)) {
    return normalized as PrimaryVisualEvidence;
  }
  if (Array.isArray(raw.quantitative_facts) && raw.quantitative_facts.length > 0) {
    return 'quantitative_difference';
  }
  if (record(raw.routing).branches) return 'task_routing';
  if (Array.isArray(raw.layers) && raw.layers.length >= 2) return 'architecture_change';
  if (Array.isArray(raw.states) && raw.states.length >= 2) return 'temporal_change';
  const comparison = record(raw.comparison);
  if (text(comparison.left, 40) && text(comparison.right, 40)) {
    return 'counterfactual_comparison';
  }
  return 'physical_action';
}

function parseOutcomeKind(value: unknown): VisualOutcomeKind {
  const normalized = text(value, 30).toLowerCase().replace(/[\s-]+/g, '_');
  return OUTCOME_KINDS.has(normalized as VisualOutcomeKind)
    ? (normalized as VisualOutcomeKind)
    : 'tradeoff';
}

function formatRegionOrder(format: VisualFormat): string[] {
  switch (format) {
    case 'cinematic_sequence':
      return ['state-1', 'state-2', 'state-3'];
    case 'cinematic_split':
      return ['left', 'right', 'right'];
    case 'cinematic_cutaway':
      return ['full-system', 'remaining-core', 'remaining-core'];
    case 'cinematic_data_contrast':
      return ['baseline', 'amplified', 'amplified'];
    case 'cinematic_routing':
      return ['route-source', 'route-a', 'route-b'];
    case 'cinematic_single':
      return ['hero', 'hero', 'hero'];
  }
}

export function overlayDirectivesForLabels(
  labels: readonly string[],
  format: VisualFormat,
): ApprovedOverlayDirective[] {
  const regions = formatRegionOrder(format);
  return labels.slice(0, 3).map((label, index) => ({
    text: label,
    regionId: regions[Math.min(index, regions.length - 1)],
    importance: index === 0 ? 'primary' : 'secondary',
  }));
}

function quantitativeFacts(value: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): { label: string; value: string } | null => {
      const row = record(entry) as RawQuantitativeFact;
      const label = text(row.label, 24);
      const amount = text(row.value, 18);
      return label && amount ? { label, value: amount } : null;
    })
    .filter((entry): entry is { label: string; value: string } => entry !== null)
    .slice(0, 3);
}

function routing(value: unknown): VisualClaim['routing'] | undefined {
  const row = record(value);
  const source = text(row.source, 160);
  const rawBranches = Array.isArray(row.branches) ? row.branches : [];
  const branches = rawBranches
    .map((entry) => {
      const branch = record(entry) as RawRouteBranch;
      const label = text(branch.label, 24);
      const destination = text(branch.destination, 150);
      const visibleOutcome = text(branch.visibleOutcome, 150);
      return label && destination && visibleOutcome
        ? { label, destination, visibleOutcome }
        : null;
    })
    .filter(
      (entry): entry is { label: string; destination: string; visibleOutcome: string } =>
        entry !== null,
    )
    .slice(0, 2);
  return source && branches.length === 2 ? { source, branches } : undefined;
}

function comparison(value: unknown): VisualClaim['comparison'] | undefined {
  const row = record(value);
  const left = text(row.left, 180);
  const right = text(row.right, 180);
  return left && right ? { left, right } : undefined;
}

export function parseAutoVisualClaim(
  rawValue: unknown,
  story: HoldoutStoryInput,
): AutoVisualClaim {
  const raw = record(rawValue) as RawClaimRow;
  const warnings: string[] = [];
  const primaryEvidence = parseEvidence(raw.primary_evidence, raw);
  const outcomeKind = parseOutcomeKind(raw.outcome_kind);
  const [fallbackContext, fallbackMechanism, fallbackOutcome] = fallbackGlyphs(story);
  const grammarRaw = record(raw.grammar);
  const rawBranches = Array.isArray(grammarRaw.branch_glyphs)
    ? grammarRaw.branch_glyphs
    : [];
  const branchGlyphs =
    rawBranches.length >= 2
      ? ([
          glyph(rawBranches[0], fallbackMechanism),
          glyph(rawBranches[1], fallbackOutcome),
        ] as [VisualGlyph, VisualGlyph])
      : null;

  const labels = stringArray(raw.labels, 3, 34);
  const facts = quantitativeFacts(raw.quantitative_facts);
  const states = stringArray(raw.states, 3, 120);
  const parsedComparison = comparison(raw.comparison);
  const layers = stringArray(raw.layers, 3, 120);
  const parsedRouting = routing(raw.routing);

  if (primaryEvidence === 'temporal_change' && states.length < 2) {
    warnings.push('temporal_without_states');
  }
  if (primaryEvidence === 'architecture_change' && layers.length < 2) {
    warnings.push('architecture_without_layers');
  }
  if (primaryEvidence === 'counterfactual_comparison' && !parsedComparison) {
    warnings.push('comparison_without_sides');
  }
  if (primaryEvidence === 'task_routing' && !parsedRouting) {
    warnings.push('routing_without_two_branches');
  }
  if (primaryEvidence === 'quantitative_difference' && facts.length === 0) {
    warnings.push('quantitative_without_facts');
  }

  const identity =
    text(raw.identity, 180) || `the visible system described by ${story.title.slice(0, 100)}`;
  const change = text(raw.change, 180) || story.summary.slice(0, 180);
  const mechanism = text(raw.mechanism, 220) || story.summary.slice(0, 220);
  const primaryOutcome =
    text(raw.primary_outcome, 220) ||
    (story.why ?? story.takeaway ?? story.summary).slice(0, 220);
  const coreClaim =
    text(raw.core_claim, 240) || `${mechanism.slice(0, 110)} leads to ${primaryOutcome.slice(0, 110)}`;

  let claim: VisualClaim = {
    storyId: story.revision_item_id,
    identity,
    change,
    mechanism,
    primaryOutcome,
    coreClaim,
    primaryEvidence,
    outcomeKind,
    approvedLabels: labels,
    quantitativeFacts: facts.length ? facts : undefined,
    states: states.length ? states : undefined,
    comparison: parsedComparison,
    layers: layers.length ? layers : undefined,
    routing: parsedRouting,
    forbiddenContradictions: stringArray(raw.forbidden_contradictions, 3, 150),
  };
  const firstPlan = compileVisualPlan(claim);
  claim = {
    ...claim,
    overlayDirectives: overlayDirectivesForLabels(labels, firstPlan.format),
  };

  return {
    storyId: story.revision_item_id,
    claim,
    grammar: {
      contextGlyph: glyph(grammarRaw.context_glyph, fallbackContext),
      mechanismGlyph: glyph(grammarRaw.mechanism_glyph, fallbackMechanism),
      outcomeGlyph: glyph(grammarRaw.outcome_glyph, fallbackOutcome),
      branchGlyphs,
      relation: relation(grammarRaw.relation),
      outcomeSignal: outcomeSignal(grammarRaw.outcome_signal, outcomeKind),
      humanBehavior: grammarRaw.human_behavior === true,
    },
    extractionWarnings: warnings,
  };
}

export function validateAutoVisualClaim(value: AutoVisualClaim): string[] {
  const issues: string[] = [];
  const { claim, grammar } = value;
  if (!claim.storyId) issues.push('missing_story_id');
  if (claim.identity.length < 8) issues.push('identity_too_short');
  if (claim.mechanism.length < 10) issues.push('mechanism_too_short');
  if (claim.primaryOutcome.length < 10) issues.push('outcome_too_short');
  if (claim.coreClaim.length < 14) issues.push('core_claim_too_short');
  if (claim.overlayDirectives && claim.overlayDirectives.length > 3) {
    issues.push('too_many_overlays');
  }
  if (!GLYPHS.has(grammar.contextGlyph)) issues.push('invalid_context_glyph');
  if (!GLYPHS.has(grammar.mechanismGlyph)) issues.push('invalid_mechanism_glyph');
  if (!GLYPHS.has(grammar.outcomeGlyph)) issues.push('invalid_outcome_glyph');
  if (!RELATIONS.has(grammar.relation)) issues.push('invalid_relation');
  if (!SIGNALS.has(grammar.outcomeSignal)) issues.push('invalid_outcome_signal');
  return issues;
}

export function compileAutoVisualClaim(value: AutoVisualClaim): VisualPlan {
  const issues = validateAutoVisualClaim(value);
  if (issues.length) {
    throw new Error(`Invalid auto visual claim ${value.storyId}: ${issues.join(', ')}`);
  }
  return compileVisualPlan(value.claim);
}

export function visualClaimExtractionJsonSchema(expectedStoryIds: readonly string[]) {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'weekly_visual_claim_batch',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claims: {
            type: 'array',
            minItems: expectedStoryIds.length,
            maxItems: expectedStoryIds.length,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                story_id: { type: 'string', enum: [...expectedStoryIds] },
                identity: { type: 'string', maxLength: 180 },
                change: { type: 'string', maxLength: 180 },
                mechanism: { type: 'string', maxLength: 220 },
                primary_outcome: { type: 'string', maxLength: 220 },
                core_claim: { type: 'string', maxLength: 240 },
                primary_evidence: {
                  type: 'string',
                  enum: [
                    'physical_action',
                    'temporal_change',
                    'architecture_change',
                    'counterfactual_comparison',
                    'quantitative_difference',
                    'task_routing',
                  ],
                },
                outcome_kind: {
                  type: 'string',
                  enum: ['benefit', 'harm', 'tradeoff', 'uncertainty'],
                },
                labels: {
                  type: 'array',
                  maxItems: 3,
                  items: { type: 'string', maxLength: 34 },
                },
                quantitative_facts: {
                  type: 'array',
                  maxItems: 3,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      label: { type: 'string', maxLength: 24 },
                      value: { type: 'string', maxLength: 18 },
                    },
                    required: ['label', 'value'],
                  },
                },
                states: {
                  type: 'array',
                  maxItems: 3,
                  items: { type: 'string', maxLength: 120 },
                },
                comparison: {
                  anyOf: [
                    { type: 'null' },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        left: { type: 'string', maxLength: 180 },
                        right: { type: 'string', maxLength: 180 },
                      },
                      required: ['left', 'right'],
                    },
                  ],
                },
                layers: {
                  type: 'array',
                  maxItems: 3,
                  items: { type: 'string', maxLength: 120 },
                },
                routing: {
                  anyOf: [
                    { type: 'null' },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        source: { type: 'string', maxLength: 160 },
                        branches: {
                          type: 'array',
                          minItems: 2,
                          maxItems: 2,
                          items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              label: { type: 'string', maxLength: 24 },
                              destination: { type: 'string', maxLength: 150 },
                              visibleOutcome: { type: 'string', maxLength: 150 },
                            },
                            required: ['label', 'destination', 'visibleOutcome'],
                          },
                        },
                      },
                      required: ['source', 'branches'],
                    },
                  ],
                },
                forbidden_contradictions: {
                  type: 'array',
                  maxItems: 3,
                  items: { type: 'string', maxLength: 150 },
                },
                grammar: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    context_glyph: { type: 'string', enum: [...VISUAL_GLYPHS] },
                    mechanism_glyph: { type: 'string', enum: [...VISUAL_GLYPHS] },
                    outcome_glyph: { type: 'string', enum: [...VISUAL_GLYPHS] },
                    branch_glyphs: {
                      anyOf: [
                        { type: 'null' },
                        {
                          type: 'array',
                          minItems: 2,
                          maxItems: 2,
                          items: { type: 'string', enum: [...VISUAL_GLYPHS] },
                        },
                      ],
                    },
                    relation: { type: 'string', enum: [...VISUAL_RELATIONS] },
                    outcome_signal: {
                      type: 'string',
                      enum: [...VISUAL_OUTCOME_SIGNALS],
                    },
                    human_behavior: { type: 'boolean' },
                  },
                  required: [
                    'context_glyph',
                    'mechanism_glyph',
                    'outcome_glyph',
                    'branch_glyphs',
                    'relation',
                    'outcome_signal',
                    'human_behavior',
                  ],
                },
              },
              required: [
                'story_id',
                'identity',
                'change',
                'mechanism',
                'primary_outcome',
                'core_claim',
                'primary_evidence',
                'outcome_kind',
                'labels',
                'quantitative_facts',
                'states',
                'comparison',
                'layers',
                'routing',
                'forbidden_contradictions',
                'grammar',
              ],
            },
          },
        },
        required: ['claims'],
      },
    },
  } as const;
}

export function visualClaimExtractionPrompt(stories: readonly HoldoutStoryInput[]): string {
  return [
    'You are the visual editor for AI Today Brief. Every image is always displayed directly beside its headline.',
    'For each supplied story, produce ONE factual visual claim. Do not try to summarize the whole article.',
    'The headline supplies company/product identity. Pixels must add the most important mechanism and its grounded outcome.',
    'Choose the evidence type that makes cause and effect easiest to see:',
    '- physical_action: one physical cause creates one result;',
    '- temporal_change: two or three states are necessary;',
    '- architecture_change: layers/components are removed, added, isolated, or transformed;',
    '- counterfactual_comparison: two matched conditions behave differently;',
    '- quantitative_difference: a reported numeric contrast is the core claim;',
    '- task_routing: one source is routed into exactly two specialist branches with different visible outputs.',
    'Use only reported facts. Never invent percentages, prices, benchmark results, downstream adoption, or safety guarantees.',
    'Labels are deterministic overlays, not text inside generated pixels. Return at most three short labels in visual reading order.',
    'For quantitative facts, copy values exactly from the story. Leave the list empty when numbers are not essential.',
    'For temporal_change provide 2-3 visible states. For architecture_change provide 2-3 layers. For task_routing provide exactly two branches. Otherwise use empty arrays/null.',
    'Select glyphs from the supplied enum as semantic anchors; glyphs are visual nouns, not product logos.',
    'The outcome must be visible, not merely compatible. Example: a route to a model is incomplete unless the branch visibly produces code, a command result, lower cost, a block, or another grounded result.',
    'Across each seven-story digest, vary formats and glyph combinations when the facts permit, but fidelity outranks variety.',
    'Return only the required JSON schema.',
    '',
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
