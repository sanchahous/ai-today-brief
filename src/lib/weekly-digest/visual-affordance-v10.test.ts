import { describe, expect, it } from 'vitest';
import type { HoldoutStoryInput } from './visual-auto-claim';
import type { AutoVisualClaimV5 } from './visual-auto-claim-v5';
import {
  chooseVisualRepairModeV10,
  evaluateVisualCandidateV10,
  proposeVisualAffordancesV10,
  validatePhysicalAnalogyMappingV10,
  validateVisualPropositionV10,
  type PhysicalAnalogyMappingV10,
  type VisualAffordanceRouterInputV10,
} from './visual-affordance-v10';

function story(input: {
  title: string;
  summary: string;
  why?: string;
  practical?: string;
  takeaway?: string;
}): HoldoutStoryInput {
  return {
    week_start: '2026-08-03',
    week_end: '2026-08-09',
    rank: 1,
    revision_item_id: input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: input.title,
    summary: input.summary,
    why: input.why ?? null,
    practical: input.practical ?? null,
    takeaway: input.takeaway ?? null,
  };
}

function claim(input: {
  identity: string;
  change: string;
  visualDriver: string;
  outcome: string;
  coreClaim: string;
  labels?: string[];
  states?: string[];
}): AutoVisualClaimV5 {
  return {
    storyId: input.identity,
    semantics: {
      explanatoryRole: 'causal_mechanism',
      certainty: 'observed',
      mappingMode: 'literal',
      visualDriver: input.visualDriver,
      metric: null,
      requiredVisibleDelta: '',
      sourceGuardTerms: [],
    },
    claim: {
      storyId: input.identity,
      identity: input.identity,
      change: input.change,
      mechanism: input.visualDriver,
      primaryOutcome: input.outcome,
      coreClaim: input.coreClaim,
      primaryEvidence: 'physical_action',
      outcomeKind: 'benefit',
      approvedLabels: input.labels ?? [],
      quantitativeFacts: [],
      states: input.states ?? [],
      forbiddenContradictions: [],
    },
  } as unknown as AutoVisualClaimV5;
}

function input(
  source: HoldoutStoryInput,
  value: AutoVisualClaimV5,
  eligible = true,
  physicalAnalogy?: PhysicalAnalogyMappingV10 | null,
): VisualAffordanceRouterInputV10 {
  return {
    story: source,
    claim: value,
    eligible,
    physicalAnalogy,
  };
}

function mappingRow(
  sourceElement: string,
  visualElement: string,
  role: 'context' | 'action' | 'outcome',
) {
  return {
    sourceElement,
    visualElement,
    role,
    required: true,
    evidenceSource: 'pixels' as const,
  };
}

describe('Visual Affordance Router v10', () => {
  it('routes same-task model consistency to a controlled comparison', () => {
    const source = story({
      title: 'Gemini faces community critique regarding model performance consistency',
      summary:
        'Developers report that the same coding task can produce inconsistent and divergent outputs across repeated runs.',
    });
    const propositions = proposeVisualAffordancesV10(
      input(
        source,
        claim({
          identity: 'Gemini coding model',
          change: 'produces inconsistent outputs on repeated runs',
          visualDriver: 'the same task is run through the same model twice',
          outcome: 'two visibly different code artifacts are produced',
          coreClaim:
            'The same coding task can produce divergent outputs across repeated Gemini runs.',
        }),
      ),
    );

    expect(propositions[0]?.affordance).toBe('controlled_comparison');
    expect(propositions[0]?.identityInvariant?.mustRemainIdenticalAcrossStates).toContain(
      'system or model chamber',
    );
    expect(propositions[0]?.forbiddenImplications.join(' ')).toMatch(
      /generic line chart/i,
    );
    expect(validateVisualPropositionV10(propositions[0]!).passed).toBe(true);
  });

  it('routes fuzzing and repair loops to a causal process sequence', () => {
    const source = story({
      title:
        'Agentic testing playbook: How fuzzing and property testing empower autonomous coding',
      summary:
        'The agent generates edge cases, exposes a failure, patches the code and retries the test.',
    });
    const propositions = proposeVisualAffordancesV10(
      input(
        source,
        claim({
          identity: 'agentic testing workflow',
          change: 'turns generated edge cases into a repair loop',
          visualDriver: 'fuzzing exposes a failure before a patch is tested again',
          outcome: 'the failing artifact becomes a verified repaired artifact',
          coreClaim:
            'Fuzzing and property testing give autonomous coding agents a visible failure-to-repair loop.',
          states: ['FUZZ', 'FAIL', 'REPAIR'],
        }),
      ),
    );

    expect(propositions[0]?.affordance).toBe('causal_process_sequence');
    expect(propositions[0]?.approvedOverlays).toEqual([
      'FUZZ',
      'FAIL',
      'REPAIR',
    ]);
    expect(propositions[0]?.identityInvariant).not.toBeNull();
  });

  it('routes token caching and operational thresholds to a technical hybrid', () => {
    const caching = story({
      title: 'Optimizing Token Caching to Avoid Unexpected Large Language Model Costs',
      summary:
        'Prompt caching prevents repeated processing of static context and can cut API costs by up to 90%.',
    });
    const threshold = story({
      title:
        'Claude Usage Thresholds: Insights from High-Volume Token Consumption',
      summary:
        'Long high-volume sessions can approach hidden rate limits and need caching, bounded session splitting and monitoring.',
    });
    const value = claim({
      identity: 'long-context agent session',
      change: 'is bounded by caching and checkpoints',
      visualDriver: 'a long stream passes through cache, split and monitor controls',
      outcome: 'the continued session stays below the risk boundary',
      coreClaim:
        'Long agent sessions need cache, split and monitoring controls before they hit hidden limits.',
      labels: ['CACHE', 'SPLIT', 'MONITOR'],
    });

    expect(proposeVisualAffordancesV10(input(caching, value))[0]?.affordance).toBe(
      'deterministic_technical_hybrid',
    );
    expect(proposeVisualAffordancesV10(input(threshold, value))[0]?.affordance).toBe(
      'deterministic_technical_hybrid',
    );
  });

  it('routes scientific discovery and deep-work behavior to cinematic domain scenes', () => {
    const research = story({
      title: 'GPT-5 Aids Immunologists in Solving T-Cell Mystery',
      summary:
        'Researchers synthesize biological datasets into an actionable T-cell interaction hypothesis.',
    });
    const deepWork = story({
      title: 'Managing AI-Driven Distraction and Rediscovering Deep Work',
      summary:
        'A person stays actively engaged while an AI sparring partner offers one bounded hint instead of completing the work.',
    });
    const researchClaim = claim({
      identity: 'immunology research team',
      change: 'uses AI analysis to connect biological datasets',
      visualDriver: 'multiple biological data strands converge through one analysis step',
      outcome: 'a concrete T-cell interaction hypothesis becomes visible',
      coreClaim:
        'AI-assisted synthesis helps researchers turn scattered T-cell evidence into an actionable hypothesis.',
    });
    const deepWorkClaim = claim({
      identity: 'person solving a difficult task',
      change: 'keeps ownership of the work while receiving one bounded hint',
      visualDriver: 'a visible AI device illuminates one specific detail only',
      outcome: 'the person continues the task with their own hands',
      coreClaim:
        'AI should act as a bounded sparring partner while the person keeps thinking and doing the work.',
    });

    expect(
      proposeVisualAffordancesV10(input(research, researchClaim))[0]
        ?.affordance,
    ).toBe('cinematic_domain_scene');
    expect(
      proposeVisualAffordancesV10(input(deepWork, deepWorkClaim))[0]
        ?.affordance,
    ).toBe('cinematic_domain_scene');
  });

  it('does not force platform expansion stories into sterile diagrams', () => {
    const source = story({
      title: 'Leveraging the Mistral AI Platform Beyond Standard Chatbot Integrations',
      summary:
        'Mistral is expanding a broader platform and ecosystem beyond a standard chatbot product.',
    });
    const propositions = proposeVisualAffordancesV10(
      input(
        source,
        claim({
          identity: 'Mistral platform',
          change: 'expands beyond a single chatbot interface',
          visualDriver: 'a broader ecosystem is being built around the core model',
          outcome: 'more application paths become possible',
          coreClaim:
            'Mistral is positioning a broader AI platform beyond standard chatbot integrations.',
        }),
      ),
    );

    expect(propositions[0]?.affordance).toBe('cinematic_domain_scene');
  });

  it('admits a physical analogy only when context, action and outcome map one-to-one', () => {
    const source = story({
      title:
        'Why frontier Anthropic models are performing worse on strict tool calling schemas',
      summary:
        'Strict schema validation rejects tool calls that do not exactly fit the required contract.',
    });
    const value = claim({
      identity: 'strict tool-call schema',
      change: 'rejects calls that do not match the exact contract',
      visualDriver: 'the attempted tool call is tested against a strict shape',
      outcome: 'a mismatched call is visibly blocked',
      coreClaim:
        'Strict tool-call schemas block outputs that do not fit the required contract exactly.',
    });
    const analogy: PhysicalAnalogyMappingV10 = {
      title: 'Exact key and lock fit',
      context: mappingRow(
        'strict schema contract',
        'one precisely machined lock',
        'context',
      ),
      action: mappingRow(
        'tool call validation',
        'one key is physically tested against the lock',
        'action',
      ),
      outcome: mappingRow(
        'invalid call is rejected',
        'the mismatched key visibly cannot enter or turn',
        'outcome',
      ),
      forbiddenDecorativeElements: ['unrelated sewing fabric'],
    };

    expect(validatePhysicalAnalogyMappingV10(analogy)).toBe(true);
    const propositions = proposeVisualAffordancesV10(
      input(source, value, true, analogy),
    );
    expect(
      propositions.some(
        (candidate) =>
          candidate.affordance === 'one_to_one_physical_analogy',
      ),
    ).toBe(true);
  });

  it('rejects required evidence delegated to labels', () => {
    const source = story({
      title: 'A comparison story',
      summary: 'The same task produces different outputs.',
    });
    const proposition = proposeVisualAffordancesV10(
      input(
        source,
        claim({
          identity: 'same system',
          change: 'produces different outputs',
          visualDriver: 'the same input is processed twice',
          outcome: 'two output artifacts differ',
          coreClaim: 'The same input produces different outputs.',
        }),
      ),
    )[0]!;
    proposition.mapping[2]!.evidenceSource = 'overlay';

    expect(validateVisualPropositionV10(proposition).issues).toContain(
      'required_evidence_delegated_to_overlay',
    );
  });

  it('fails closed when the explanatory claim is ineligible', () => {
    const source = story({
      title: 'Unresolved announcement',
      summary: 'The source does not support a stable explanatory claim.',
    });
    const propositions = proposeVisualAffordancesV10(
      input(
        source,
        claim({
          identity: 'unresolved announcement',
          change: 'may change later',
          visualDriver: 'unknown',
          outcome: 'unknown',
          coreClaim: 'Unsupported claim',
        }),
        false,
      ),
    );

    expect(propositions).toHaveLength(1);
    expect(propositions[0]?.affordance).toBe('source_led_fallback');
    expect(propositions[0]?.coreClaim).toBe('');
    expect(propositions[0]?.expectedImageCalls).toBe(0);
    expect(validateVisualPropositionV10(propositions[0]!).passed).toBe(true);
  });
});

describe('Visual repair policy v10', () => {
  it('repairs broken arrows without replanning a good concept', () => {
    expect(chooseVisualRepairModeV10(['broken_arrow'])).toBe(
      'recompose_geometry',
    );
  });

  it('uses a local edit for a disconnected magnifier or beam', () => {
    expect(chooseVisualRepairModeV10(['disconnected_prop'])).toBe(
      'edit_local_region',
    );
    expect(
      chooseVisualRepairModeV10([
        'beam_without_visible_source',
        'beam_without_meaningful_target',
      ]),
    ).toBe('edit_local_region');
  });

  it('regenerates anatomy failures instead of accepting a high semantic score', () => {
    expect(
      chooseVisualRepairModeV10(['unowned_hand', 'extra_limb'], 1),
    ).toBe('regenerate_scene');
  });

  it('replans weak visual theses and ambiguous charts', () => {
    expect(
      chooseVisualRepairModeV10([
        'weak_visual_thesis',
        'uninterpretable_chart',
      ]),
    ).toBe('replan_proposition');
  });

  it('never emits an automated production pass', () => {
    const accepted = evaluateVisualCandidateV10([]);
    expect(accepted.eligibleForOwnerReview).toBe(true);
    expect(accepted.ownerReviewRequired).toBe(true);
    expect(accepted.automatedProductionPass).toBe(false);
  });
});
