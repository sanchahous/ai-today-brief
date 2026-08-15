import { describe, expect, it } from 'vitest';
import {
  briefsPassingMappingGate,
  propositionFromBrief,
  validateConceptMapping,
  type ConceptMappingEntry,
  type ConceptProposition,
  type SemanticProp,
} from './concept-mapping-gate';

const MAPPINGS: ConceptMappingEntry[] = [
  {
    sourceElement: 'strict schema',
    visibleElement: 'precision lock on the bench',
    visibleElementId: 'lock',
    visibleRole: 'context',
  },
  {
    sourceElement: 'malformed tool call',
    visibleElement: 'wrong key at the lock face',
    visibleElementId: 'key',
    visibleRole: 'action',
  },
  {
    sourceElement: 'pre-execution rejection',
    visibleElement: 'stopped bolt before the latch',
    visibleElementId: 'bolt',
    visibleRole: 'outcome',
  },
];

const PROPS: SemanticProp[] = [
  { id: 'lock', role: 'schema' },
  { id: 'key', role: 'tool call' },
  { id: 'bolt', role: 'rejection' },
];

function proposition(partial: Partial<ConceptProposition> = {}): ConceptProposition {
  return {
    coreClaim: 'A strict schema rejects malformed tool calls before execution.',
    contextAnchor: 'A precision lock represents the strict schema boundary.',
    visibleAction: 'A malformed key visibly fails to enter the lock.',
    visibleOutcome: 'The blocked mechanism remains stopped before execution.',
    mappings: MAPPINGS,
    semanticProps: PROPS,
    ...partial,
  };
}

describe('validateConceptMapping', () => {
  it('accepts a complete source-to-visible-to-outcome table', () => {
    expect(validateConceptMapping(proposition())).toEqual({ passed: true, issues: [] });
  });

  it('empty semanticProps do not vacuously pass the mapping gate', () => {
    expect(validateConceptMapping(proposition({ semanticProps: [] }))).toEqual({
      passed: false,
      issues: ['empty_semantic_props'],
    });
  });

  it('unmapped_semantic_prop matches visibleElementId not visibleElement labels', () => {
    const byLabel = validateConceptMapping(
      proposition({
        semanticProps: [
          { id: 'precision lock on the bench', role: 'schema' },
          { id: 'wrong key at the lock face', role: 'tool call' },
          { id: 'stopped bolt before the latch', role: 'rejection' },
        ],
      }),
    );
    expect(byLabel.passed).toBe(false);
    expect(byLabel.issues).toContain('unmapped_semantic_prop');
    expect(byLabel.issues).toContain('unmapped_visible_element');

    const byId = validateConceptMapping(
      proposition({
        semanticProps: PROPS,
      }),
    );
    expect(byId).toEqual({ passed: true, issues: [] });
  });

  it('rejects a concept missing the visible outcome row', () => {
    const result = validateConceptMapping(
      proposition({
        visibleOutcome: '',
        mappings: MAPPINGS.slice(0, 2),
        semanticProps: PROPS.slice(0, 2),
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('missing_visible_outcome');
    expect(result.issues).toContain('incomplete_mapping');
  });
});

describe('propositionFromBrief', () => {
  it('derives the mapping table from storyAnchor / visibleMechanism / visibleConsequence', () => {
    const derived = propositionFromBrief({
      visualThesis: 'An adapter card connecting into a terminal lets the old system run new tools.',
      storyContext: 'Simon Willison plugin brings Claude tools to the command line.',
      mechanism: 'A CLI plugin exposes server-side tools through a local command.',
      consequence: 'Developers invoke those tools from the command line.',
      storyAnchor: 'a brass adapter card in a teleprinter slot',
      visibleMechanism: 'the card connecting server tools into the local command',
      visibleConsequence: 'the old terminal runs the new tools',
    });
    expect(validateConceptMapping(derived).passed).toBe(true);
    expect(derived.mappings.map((row) => row.visibleElementId)).toEqual([
      'context',
      'action',
      'outcome',
    ]);
  });

  it('keeps an explicit empty semanticProps array so the vacuum check can fire', () => {
    const derived = propositionFromBrief({
      visualThesis: 'An adapter card connecting into a terminal lets the old system run new tools.',
      storyAnchor: 'a brass adapter card in a teleprinter slot',
      visibleMechanism: 'the card connecting server tools into the local command',
      visibleConsequence: 'the old terminal runs the new tools',
      mappings: MAPPINGS,
      semanticProps: [],
    });
    expect(validateConceptMapping(derived).issues).toContain('empty_semantic_props');
  });
});

describe('briefsPassingMappingGate', () => {
  it('a concept missing visible outcome does not enter the prompt set', () => {
    const mapped = {
      visualThesis: 'An adapter card connecting into a terminal lets the old system run new tools.',
      storyContext: 'Simon Willison plugin brings Claude tools to the command line.',
      mechanism: 'A CLI plugin exposes server-side tools through a local command.',
      consequence: 'Developers invoke those tools from the command line.',
      storyAnchor: 'a brass adapter card in a teleprinter slot',
      visibleMechanism: 'the card connecting server tools into the local command',
      visibleConsequence: 'the old terminal runs the new tools',
    };
    const accepted = briefsPassingMappingGate([
      mapped,
      { ...mapped, visibleConsequence: '', storyAnchor: 'a decorative sewing machine in a room' },
    ]);
    expect(accepted).toEqual([mapped]);
  });
});
