/**
 * Concept mapping gate for weekly illustration prompts. A concept without a
 * complete source → visible object → visible outcome table does not enter
 * `story_prompt_set`. Identity is `visibleElementId`, not free-text labels.
 * Does not import the experimental V10 cluster.
 */

export const MAPPING_ROLES = ['context', 'action', 'outcome'] as const;
export type MappingRole = (typeof MAPPING_ROLES)[number];

export const MAPPING_GATE_ISSUES = [
  'missing_core_claim',
  'missing_context_anchor',
  'missing_visible_action',
  'missing_visible_outcome',
  'incomplete_mapping',
  'empty_semantic_props',
  'unmapped_semantic_prop',
  'unmapped_visible_element',
] as const;
export type MappingGateIssue = (typeof MAPPING_GATE_ISSUES)[number];

export interface ConceptMappingEntry {
  sourceElement: string;
  visibleElement: string;
  visibleElementId: string;
  visibleRole: MappingRole;
}

export interface SemanticProp {
  id: string;
  role: string;
}

export interface ConceptProposition {
  coreClaim: string;
  contextAnchor: string;
  visibleAction: string;
  visibleOutcome: string;
  mappings: readonly ConceptMappingEntry[];
  semanticProps: readonly SemanticProp[];
}

export interface MappingGateBrief {
  visualThesis?: string;
  storyContext?: string;
  mechanism?: string;
  consequence?: string;
  storyAnchor?: string;
  visibleMechanism?: string;
  visibleConsequence?: string;
  mappings?: readonly ConceptMappingEntry[];
  semanticProps?: readonly SemanticProp[];
}

export interface MappingGateEssence {
  visualThesis?: string;
  storyContext?: string;
  mechanism?: string;
  consequence?: string;
}

export interface MappingGateResult {
  passed: boolean;
  issues: MappingGateIssue[];
}

const MIN_CLAIM = 12;
const MIN_VISIBLE = 8;

export function validateConceptMapping(proposition: ConceptProposition): MappingGateResult {
  const issues: MappingGateIssue[] = [];
  pushClaimIssues(proposition, issues);
  pushMappingIssues(proposition, issues);
  pushIdentityIssues(proposition, issues);
  return { passed: issues.length === 0, issues };
}

export function propositionFromBrief(
  brief: MappingGateBrief,
  essence: MappingGateEssence = {},
): ConceptProposition {
  const mappings = brief.mappings?.length
    ? [...brief.mappings]
    : derivedMappings(brief, essence);
  return {
    coreClaim: trim(brief.visualThesis) || trim(essence.visualThesis),
    contextAnchor: trim(brief.storyAnchor) || visibleForRole(mappings, 'context'),
    visibleAction: trim(brief.visibleMechanism) || visibleForRole(mappings, 'action'),
    visibleOutcome: trim(brief.visibleConsequence) || visibleForRole(mappings, 'outcome'),
    mappings,
    semanticProps: brief.semanticProps ?? derivedSemanticProps(mappings),
  };
}

export function briefsPassingMappingGate<T extends MappingGateBrief>(
  briefs: readonly T[],
  essence: MappingGateEssence = {},
): T[] {
  const accepted: T[] = [];
  for (const brief of briefs) {
    if (validateConceptMapping(propositionFromBrief(brief, essence)).passed) {
      accepted.push(brief);
    }
  }
  return accepted;
}

function derivedMappings(
  brief: MappingGateBrief,
  essence: MappingGateEssence,
): ConceptMappingEntry[] {
  return [
    mappingRow(
      'context',
      trim(brief.storyContext) || trim(essence.storyContext),
      trim(brief.storyAnchor),
    ),
    mappingRow(
      'action',
      trim(brief.mechanism) || trim(essence.mechanism),
      trim(brief.visibleMechanism),
    ),
    mappingRow(
      'outcome',
      trim(brief.consequence) || trim(essence.consequence),
      trim(brief.visibleConsequence),
    ),
  ];
}

function mappingRow(
  visibleRole: MappingRole,
  sourceElement: string,
  visibleElement: string,
): ConceptMappingEntry {
  return {
    sourceElement,
    visibleElement,
    visibleElementId: visibleRole,
    visibleRole,
  };
}

function derivedSemanticProps(mappings: readonly ConceptMappingEntry[]): SemanticProp[] {
  return mappings.map((entry) => ({
    id: entry.visibleElementId,
    role: entry.visibleRole,
  }));
}

function pushClaimIssues(proposition: ConceptProposition, issues: MappingGateIssue[]): void {
  if (trim(proposition.coreClaim).length < MIN_CLAIM) issues.push('missing_core_claim');
  if (trim(proposition.contextAnchor).length < MIN_VISIBLE) {
    issues.push('missing_context_anchor');
  }
  if (trim(proposition.visibleAction).length < MIN_VISIBLE) {
    issues.push('missing_visible_action');
  }
  if (trim(proposition.visibleOutcome).length < MIN_VISIBLE) {
    issues.push('missing_visible_outcome');
  }
}

function pushMappingIssues(proposition: ConceptProposition, issues: MappingGateIssue[]): void {
  const complete = completeMappingRows(proposition.mappings);
  const roles = new Set(complete.map((entry) => entry.visibleRole));
  const ids = complete.map((entry) => trim(entry.visibleElementId));
  const uniqueIds = new Set(ids);
  if (
    complete.length < MAPPING_ROLES.length ||
    roles.size < MAPPING_ROLES.length ||
    uniqueIds.size !== ids.length
  ) {
    issues.push('incomplete_mapping');
  }
}

function pushIdentityIssues(proposition: ConceptProposition, issues: MappingGateIssue[]): void {
  if (proposition.semanticProps.length === 0) {
    issues.push('empty_semantic_props');
    return;
  }
  const mappedIds = new Set(
    completeMappingRows(proposition.mappings).map((entry) => trim(entry.visibleElementId)),
  );
  const propIds = new Set(
    proposition.semanticProps
      .map((prop) => trim(prop.id))
      .filter(Boolean),
  );
  if ([...propIds].some((id) => !mappedIds.has(id))) {
    issues.push('unmapped_semantic_prop');
  }
  if ([...mappedIds].some((id) => !propIds.has(id))) {
    issues.push('unmapped_visible_element');
  }
}

function completeMappingRows(
  mappings: readonly ConceptMappingEntry[],
): ConceptMappingEntry[] {
  const rows: ConceptMappingEntry[] = [];
  for (const entry of mappings) {
    if (
      trim(entry.sourceElement).length < MIN_VISIBLE ||
      trim(entry.visibleElement).length < MIN_VISIBLE ||
      !trim(entry.visibleElementId)
    ) {
      continue;
    }
    rows.push(entry);
  }
  return rows;
}

function visibleForRole(
  mappings: readonly ConceptMappingEntry[],
  role: MappingRole,
): string {
  for (const entry of mappings) {
    if (entry.visibleRole === role) return trim(entry.visibleElement);
  }
  return '';
}

function trim(value: string | undefined): string {
  return value?.trim() ?? '';
}
