import { describe, expect, it } from 'vitest';
import {
  requiresProcessGrammar,
  selectSceneGrammar,
  uniqueProcessTokens,
  type SceneGrammarEssence,
  type SceneGrammarInput,
} from './scene-grammar';

const DOMAIN_ESSENCE: SceneGrammarEssence = {
  storyContext: 'Researchers opened a new immunology laboratory.',
  meaning: 'A scientific team is doing deep work on immune response.',
  mechanism: 'Scientists isolate T-cells in a controlled lab.',
  consequence: 'The team can see whether the treatment holds.',
  visualThesis: 'Researchers at the bench make the immune response visible.',
};

function domainStory(partial: Partial<SceneGrammarInput> = {}): SceneGrammarInput {
  return {
    title: 'Researchers open a new immunology lab',
    summary: 'A grounded domain story about scientists on the factory floor.',
    practical: 'Budget about 2 hours for the first run.',
    takeaway: 'Save 40% this quarter if the protocol sticks.',
    why: 'The 3x speedup is only a workshop estimate.',
    essence: DOMAIN_ESSENCE,
    ...partial,
  };
}

describe('selectSceneGrammar', () => {
  it('an incidental duration in practical does not switch a domain story to the diagram grammar', () => {
    expect(selectSceneGrammar(domainStory())).toBe('cinematic_domain_scene');
  });

  it('a single mention of caching does not select the process grammar', () => {
    const input = domainStory({
      title: 'A plugin adds caching for repeated tool calls',
      summary: 'Developers wait less on the second run.',
      practical: '',
      takeaway: '',
      why: '',
    });
    expect(requiresProcessGrammar(`${input.title} ${input.summary}`)).toBe(false);
    expect(uniqueProcessTokens(`${input.title} ${input.summary}`)).toEqual(['caching']);
    expect(selectSceneGrammar(input)).toBe('cinematic_domain_scene');
  });

  it('an exact metric in the headline selects the diagram grammar', () => {
    expect(
      selectSceneGrammar(
        domainStory({
          title: 'Inference cost dropped 82% after the routing change',
          summary: 'The same model now spends less per completed task.',
          practical: '',
          takeaway: '',
          why: '',
        }),
      ),
    ).toBe('deterministic_technical_hybrid');
  });

  it('a metric only in essence claim text selects the diagram grammar', () => {
    expect(
      selectSceneGrammar(
        domainStory({
          essence: {
            ...DOMAIN_ESSENCE,
            mechanism: 'Routing cut completed-task cost by 82%.',
          },
        }),
      ),
    ).toBe('deterministic_technical_hybrid');
  });

  it('two process tokens without a metric stay cinematic', () => {
    const title = 'Crash and restart loops waste a night of GPU work';
    const summary = 'The run does not resume from a saved checkpoint.';
    expect(requiresProcessGrammar(`${title} ${summary}`)).toBe(true);
    expect(
      selectSceneGrammar(
        domainStory({
          title,
          summary,
          practical: '',
          takeaway: '',
          why: '',
        }),
      ),
    ).toBe('cinematic_domain_scene');
  });

  it('fallback source stays source-led even when the headline has a metric', () => {
    expect(
      selectSceneGrammar(
        domainStory({
          title: 'Inference cost dropped 82% after the routing change',
          source: 'fallback',
        }),
      ),
    ).toBe('source_led_fallback');
  });
});
