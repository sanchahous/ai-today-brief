import type {
  AutoVisualClaimV5,
  VisualExplanatoryRole,
} from './visual-auto-claim-v5';
import type { HoldoutStoryInput } from './visual-auto-claim';

export const VISUAL_TREATMENT_MODES_V6 = [
  'deterministic_literal',
  'generated_audited_analogy',
] as const;

export type VisualTreatmentModeV6 = (typeof VISUAL_TREATMENT_MODES_V6)[number];

export interface AnalogyMappingV6 {
  sourceElement: string;
  physicalElement: string;
}

export interface AnalogyPlanV6 {
  storyId: string;
  title: string;
  subject: string;
  action: string;
  setting: string;
  props: string[];
  sourceAnchor: string;
  visibleMechanism: string;
  visibleOutcome: string;
  mappings: AnalogyMappingV6[];
  whyItFits: string;
  unsupportedAssertions: string[];
  forbiddenVisuals: string[];
}

export interface AnalogyAuditV6 {
  storyId: string;
  passed: boolean;
  sourceAnchorPreserved: boolean;
  mechanismPreserved: boolean;
  outcomePreserved: boolean;
  certaintyPreserved: boolean;
  oneToOneMapping: boolean;
  visuallyTestable: boolean;
  unsupportedSpecifics: boolean;
  issues: string[];
  rationale: string;
}

export interface HybridTreatmentV6 {
  storyId: string;
  role: VisualExplanatoryRole;
  mode: VisualTreatmentModeV6;
  reason: string;
  labels: string[];
  analogy: AnalogyPlanV6 | null;
  analogyAudit: AnalogyAuditV6 | null;
  eligible: boolean;
}

const GENERATED_ANALOGY_ROLES = new Set<VisualExplanatoryRole>([
  'causal_mechanism',
  'policy_control',
  'capability_access',
]);

const BANNED_RENDER_LANGUAGE =
  /\b(screen|dashboard|interface|ui\b|code editor|terminal window|printed text|readable text|caption|labelled|labeled|signage|logo|watermark|infographic|flowchart|diagram|split screen|collage|glowing brain|neural mesh|generic ai)\b/i;

function clean(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function sourceText(story: HoldoutStoryInput): string {
  return [story.title, story.summary, story.why, story.practical, story.takeaway]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactMoney(value: string): string {
  return value
    .replace(/\$\s*/g, '$')
    .replace(/\b(million)\b/gi, 'M')
    .replace(/\b(billion)\b/gi, 'B')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function exactDeterministicLabelsV6(
  value: AutoVisualClaimV5,
  story: HoldoutStoryInput,
): string[] {
  const source = sourceText(story);
  const base = unique(value.claim.approvedLabels.map((label) => clean(label, 34))).slice(0, 3);

  const upToPercent = source.match(/\bup to\s+(\d+(?:\.\d+)?)\s*%/i);
  if (upToPercent?.[1]) {
    const guarded = `UP TO ${upToPercent[1]}%`;
    const withoutNumeric = base.filter((label) => !/\d+(?:\.\d+)?\s*%/.test(label));
    return [...withoutNumeric.slice(0, 2), guarded].slice(0, 3);
  }

  if (value.semantics.explanatoryRole === 'uncertainty_announcement') {
    const current = source.match(/\b(?:reaching|reached)\s+(over\s+\$\s*\d+(?:\.\d+)?\s+(?:million|billion))(?:\s+ARR)?/i);
    const target = source.match(/\b(?:surpass|exceed|reach)\s+(\$\s*\d+(?:\.\d+)?\s+(?:million|billion))(?:\s+ARR)?/i);
    if (current?.[1] && target?.[1]) {
      const guard = /\bon track\b/i.test(source)
        ? 'ON TRACK'
        : /\bexpected\b/i.test(source)
          ? 'EXPECTED'
          : 'PLANNED';
      return [
        `${compactMoney(current[1])} ARR`,
        `${compactMoney(target[1])} ARR`,
        guard,
      ];
    }
  }

  return base;
}

export function validateAnalogyPlanV6(
  plan: AnalogyPlanV6,
  value: AutoVisualClaimV5,
): string[] {
  const issues: string[] = [];
  const role = value.semantics.explanatoryRole;
  if (!GENERATED_ANALOGY_ROLES.has(role)) issues.push('analogy_role_not_allowed');
  if (plan.storyId !== value.storyId) issues.push('story_id_mismatch');
  if (clean(plan.subject, 180).length < 8) issues.push('subject_too_short');
  if (clean(plan.action, 220).length < 12) issues.push('action_too_short');
  if (clean(plan.setting, 180).length < 8) issues.push('setting_too_short');
  if (clean(plan.sourceAnchor, 180).length < 8) issues.push('source_anchor_missing');
  if (clean(plan.visibleMechanism, 220).length < 12) issues.push('visible_mechanism_missing');
  if (clean(plan.visibleOutcome, 220).length < 12) issues.push('visible_outcome_missing');
  if (clean(plan.whyItFits, 320).length < 24) issues.push('mapping_rationale_too_short');
  if (plan.mappings.length !== 3) issues.push('exactly_three_mappings_required');
  if (new Set(plan.mappings.map((mapping) => clean(mapping.sourceElement, 120))).size !== 3) {
    issues.push('mapping_source_elements_not_distinct');
  }
  if (new Set(plan.mappings.map((mapping) => clean(mapping.physicalElement, 120))).size !== 3) {
    issues.push('mapping_physical_elements_not_distinct');
  }
  if (plan.unsupportedAssertions.length > 0) issues.push('unsupported_assertions_present');
  const renderable = [
    plan.subject,
    plan.action,
    plan.setting,
    ...plan.props,
    plan.sourceAnchor,
    plan.visibleMechanism,
    plan.visibleOutcome,
    ...plan.mappings.flatMap((mapping) => [mapping.sourceElement, mapping.physicalElement]),
  ].join(' ');
  if (BANNED_RENDER_LANGUAGE.test(renderable)) issues.push('banned_render_language');
  if (/\b(two unrelated|multiple panels|before and after panels|left panel|right panel)\b/i.test(renderable)) {
    issues.push('collage_or_panel_composition');
  }
  if (
    ['planned', 'expected', 'claimed', 'reported', 'uncertain'].includes(
      value.semantics.certainty,
    )
  ) {
    issues.push('guarded_certainty_requires_deterministic_literal');
  }
  return unique(issues);
}

export function selectHybridTreatmentModeV6(
  value: AutoVisualClaimV5,
  analogy: AnalogyPlanV6 | null,
  audit: AnalogyAuditV6 | null,
): VisualTreatmentModeV6 {
  if (
    value.semantics.explanatoryRole === 'causal_mechanism' &&
    analogy &&
    audit?.passed &&
    validateAnalogyPlanV6(analogy, value).length === 0
  ) {
    return 'generated_audited_analogy';
  }
  return 'deterministic_literal';
}

export function buildHybridTreatmentV6(
  value: AutoVisualClaimV5,
  story: HoldoutStoryInput,
  analogy: AnalogyPlanV6 | null,
  audit: AnalogyAuditV6 | null,
): HybridTreatmentV6 {
  const mode = selectHybridTreatmentModeV6(value, analogy, audit);
  return {
    storyId: value.storyId,
    role: value.semantics.explanatoryRole,
    mode,
    reason:
      mode === 'generated_audited_analogy'
        ? 'A separate source audit approved a one-to-one physical mapping for the causal mechanism.'
        : value.semantics.explanatoryRole === 'causal_mechanism'
          ? 'No audited one-to-one analogy passed; retain deterministic fallback.'
          : 'This explanatory role is safer and clearer as deterministic literal geometry.',
    labels: exactDeterministicLabelsV6(value, story),
    analogy: mode === 'generated_audited_analogy' ? analogy : null,
    analogyAudit: audit,
    eligible: mode === 'deterministic_literal' || Boolean(audit?.passed),
  };
}

export function analogyPlannerPromptV6(
  story: HoldoutStoryInput,
  value: AutoVisualClaimV5,
  priorIssues: readonly string[] = [],
): string {
  const template = {
    story_id: story.revision_item_id,
    title: 'short concept title',
    subject: 'one concrete focal physical subject',
    action: 'one visible physical action',
    setting: 'one coherent real physical environment',
    props: ['one or two supporting physical props'],
    source_anchor: 'what physically identifies the source situation without text or logos',
    visible_mechanism: 'the source causal process mapped to physical action',
    visible_outcome: 'the source result mapped to physical evidence',
    mappings: [
      { source_element: 'source identity/context', physical_element: 'physical anchor' },
      { source_element: 'source causal mechanism', physical_element: 'physical action' },
      { source_element: 'source outcome', physical_element: 'physical result' },
    ],
    why_it_fits: 'explain the exact one-to-one mapping without adding facts',
    unsupported_assertions: [],
    forbidden_visuals: ['readable text', 'UI', 'logos'],
  };
  return [
    'You are designing one source-grounded physical editorial analogy for AI Today Brief.',
    'The headline will appear outside the image. The generated pixels must contain no readable text, numbers, UI, code, logos, arrows, captions or infographic panels.',
    'Create one coherent physical scene, not a collage. It must expose a one-to-one mapping from source identity/context to a physical anchor, source mechanism to a physical action, and source outcome to physical evidence.',
    'Do not add implementation details, performance claims, availability, certainty or downstream results absent from the approved story.',
    `APPROVED STORY=${JSON.stringify({
      headline: story.title,
      summary: story.summary,
      why: story.why,
      practical: story.practical,
      takeaway: story.takeaway,
    })}`,
    `APPROVED CLAIM=${JSON.stringify({
      identity: value.claim.identity,
      driver: value.semantics.visualDriver,
      outcome: value.claim.primaryOutcome,
      core_claim: value.claim.coreClaim,
      certainty: value.semantics.certainty,
      forbidden_contradictions: value.claim.forbiddenContradictions,
    })}`,
    priorIssues.length ? `PREVIOUS ISSUES=${priorIssues.join('; ')}` : '',
    `RETURN JSON ONLY=${JSON.stringify(template)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function analogyAuditPromptV6(
  story: HoldoutStoryInput,
  value: AutoVisualClaimV5,
  plan: AnalogyPlanV6,
): string {
  return [
    'Act as an independent source-fidelity gate for a proposed editorial analogy.',
    'The approved story is the only factual source. Evaluate the mapping, not its prose quality.',
    `APPROVED STORY=${JSON.stringify({
      headline: story.title,
      summary: story.summary,
      why: story.why,
      practical: story.practical,
      takeaway: story.takeaway,
    })}`,
    `APPROVED CLAIM=${JSON.stringify({
      role: value.semantics.explanatoryRole,
      certainty: value.semantics.certainty,
      identity: value.claim.identity,
      driver: value.semantics.visualDriver,
      outcome: value.claim.primaryOutcome,
      core_claim: value.claim.coreClaim,
      forbidden_contradictions: value.claim.forbiddenContradictions,
    })}`,
    `PROPOSED ANALOGY=${JSON.stringify(plan)}`,
    'Pass only when: the source anchor, mechanism and outcome are all preserved; the three mappings are one-to-one; the scene is visually testable without generated text; certainty is unchanged; and no unsupported specifics are introduced.',
    'Return JSON only: {"story_id":"copy exactly","passed":boolean,"source_anchor_preserved":boolean,"mechanism_preserved":boolean,"outcome_preserved":boolean,"certainty_preserved":boolean,"one_to_one_mapping":boolean,"visually_testable":boolean,"unsupported_specifics":boolean,"issues":["codes"],"rationale":"brief"}.',
  ].join('\n');
}

export function analogyImagePromptV6(
  value: AutoVisualClaimV5,
  plan: AnalogyPlanV6,
): string {
  return [
    `${plan.subject} ${plan.action} in ${plan.setting}.`,
    plan.props.length ? `Supporting physical props: ${plan.props.join(', ')}.` : '',
    `The physical story anchor is ${plan.sourceAnchor}.`,
    `The visible causal action is ${plan.visibleMechanism}.`,
    `The visible physical result is ${plan.visibleOutcome}.`,
    'One coherent editorial photograph with one focal action and an immediately readable cause-to-effect relationship.',
    'Premium technology-magazine cinematography, believable materials and physics, strong silhouette, restrained dramatic light, wide 16:9 composition, calm margins for an external headline.',
    'Absolutely no readable text, letters, numbers, code, UI, logos, captions, labels, arrows, diagrams, infographic panels, split screens, watermarks or brand marks.',
    `Do not contradict: ${value.claim.forbiddenContradictions.join('; ') || 'the approved source claim'}.`,
  ]
    .filter(Boolean)
    .join(' ');
}
