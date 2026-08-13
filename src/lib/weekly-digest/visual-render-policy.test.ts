import { describe, expect, it } from 'vitest';
import { compileVisualPlan, type VisualClaim } from './visual-compiler';
import {
  decideVisualRenderPolicy,
  selectVisualRenderMode,
} from './visual-render-policy';

function claim(overrides: Partial<VisualClaim>): VisualClaim {
  return {
    storyId: 'story',
    identity: 'one visible technical system',
    change: 'one visible change',
    mechanism: 'one physical mechanism',
    primaryOutcome: 'one visible outcome',
    coreClaim: 'one mechanism causes one outcome',
    primaryEvidence: 'physical_action',
    outcomeKind: 'benefit',
    ...overrides,
  };
}

describe('visual render policy', () => {
  it.each([
    ['quantitative_difference', 'cinematic_data_contrast'],
    ['architecture_change', 'cinematic_cutaway'],
    ['task_routing', 'cinematic_routing'],
  ] as const)(
    'routes %s to deterministic cinematic geometry',
    (primaryEvidence, expectedFormat) => {
      const plan = compileVisualPlan(claim({ primaryEvidence }));
      expect(plan.format).toBe(expectedFormat);
      expect(selectVisualRenderMode(plan)).toBe('deterministic_vector');
      expect(decideVisualRenderPolicy(plan)).toMatchObject({
        mode: 'deterministic_vector',
        imageCalls: 0,
        visionCalls: 2,
        estimatedCostUsd: 0.02,
        withinBudget: true,
      });
    },
  );

  it('keeps temporal state changes as reference-conditioned generation', () => {
    const plan = compileVisualPlan(
      claim({
        primaryEvidence: 'temporal_change',
        states: ['RUN', 'CRASH', 'RESUME'],
      }),
    );
    expect(decideVisualRenderPolicy(plan)).toMatchObject({
      mode: 'generated_reference_sequence',
      imageCalls: 3,
      estimatedCostUsd: 0.065,
      withinBudget: true,
    });
  });

  it('uses a neutral identity reference before opposite human actions', () => {
    const plan = compileVisualPlan(
      claim({
        identity: 'the same student and tutoring assistant in two matched situations',
        mechanism:
          'the default tutor moves the learner’s blocks while the evaluated tutor keeps both hands back',
        primaryEvidence: 'counterfactual_comparison',
        comparison: {
          left: 'the tutor constantly intervenes',
          right: 'the student acts independently',
        },
      }),
    );
    expect(decideVisualRenderPolicy(plan)).toMatchObject({
      mode: 'generated_identity_action_pair',
      imageCalls: 3,
      estimatedCostUsd: 0.065,
      withinBudget: true,
    });
  });

  it('uses a two-scene action pair for non-human comparisons', () => {
    const plan = compileVisualPlan(
      claim({
        identity: 'the same sub-agent game build and inspection system',
        mechanism: 'the build succeeds while the visual inspection misses a defect',
        primaryEvidence: 'counterfactual_comparison',
        comparison: {
          left: 'agents assemble a game scene',
          right: 'an inspection camera misses a broken texture',
        },
      }),
    );
    expect(decideVisualRenderPolicy(plan)).toMatchObject({
      mode: 'generated_action_pair',
      imageCalls: 2,
      estimatedCostUsd: 0.05,
      withinBudget: true,
    });
  });

  it('keeps all supported render modes under the accepted-image budget', () => {
    const plans = [
      compileVisualPlan(claim({ primaryEvidence: 'quantitative_difference' })),
      compileVisualPlan(claim({ primaryEvidence: 'architecture_change' })),
      compileVisualPlan(claim({ primaryEvidence: 'task_routing' })),
      compileVisualPlan(
        claim({ primaryEvidence: 'temporal_change', states: ['A', 'B', 'C'] }),
      ),
      compileVisualPlan(
        claim({
          identity: 'a student and human tutor',
          primaryEvidence: 'counterfactual_comparison',
        }),
      ),
      compileVisualPlan(claim({ primaryEvidence: 'physical_action' })),
    ];
    for (const plan of plans) expect(decideVisualRenderPolicy(plan).withinBudget).toBe(true);
  });
});
