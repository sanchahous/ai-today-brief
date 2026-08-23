import { describe, expect, it } from 'vitest';
import {
  requiresProcessGrammar,
  selectSceneGrammar,
  templateIdForSceneGrammar,
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

describe('grammar signals (source-agnostic, no lens)', () => {
  it('an incidental duration in practical does not raise a metric signal', () => {
    const signals = domainStory();
    expect(uniqueProcessTokens(`${signals.title} ${signals.summary}`)).toEqual([]);
  });

  it('a single mention of caching does not select the process signal', () => {
    const input = domainStory({
      title: 'A plugin adds caching for repeated tool calls',
      summary: 'Developers wait less on the second run.',
      practical: '',
      takeaway: '',
      why: '',
    });
    expect(requiresProcessGrammar(`${input.title} ${input.summary}`)).toBe(false);
    expect(uniqueProcessTokens(`${input.title} ${input.summary}`)).toEqual(['caching']);
  });

  it('two process tokens raise the process signal', () => {
    const title = 'Crash and restart loops waste a night of GPU work';
    const summary = 'The run does not resume from a saved checkpoint.';
    expect(requiresProcessGrammar(`${title} ${summary}`)).toBe(true);
  });
});

describe('selectSceneGrammar without a mechanism lens', () => {
  it('an incidental duration in practical does not switch a domain story to the diagram grammar', () => {
    expect(selectSceneGrammar(domainStory())).toBe('cinematic_domain_scene');
  });

  it('a single mention of caching does not select the diagram grammar', () => {
    const input = domainStory({
      title: 'A plugin adds caching for repeated tool calls',
      summary: 'Developers wait less on the second run.',
      practical: '',
      takeaway: '',
      why: '',
    });
    expect(selectSceneGrammar(input)).toBe('cinematic_domain_scene');
  });

  it('an exact metric in the headline does NOT select the diagram grammar for literal_context or consequence (R2.1 / F6)', () => {
    // Before R2.1, one metric anywhere in the story pushed ALL THREE concepts
    // to the diagram grammar -- the owner explicitly wants variety across
    // the three seats ("sometimes scene, sometimes diagram"), not three
    // copies of the same call. Only `mechanism` is eligible.
    const metricStory = domainStory({
      title: 'Inference cost dropped 82% after the routing change',
      summary: 'The same model now spends less per completed task.',
      practical: '',
      takeaway: '',
      why: '',
    });
    expect(selectSceneGrammar({ ...metricStory, lens: 'literal_context' })).toBe(
      'cinematic_domain_scene',
    );
    expect(selectSceneGrammar({ ...metricStory, lens: 'consequence' })).toBe(
      'cinematic_domain_scene',
    );
    expect(selectSceneGrammar({ ...metricStory, lens: 'owner_direction' })).toBe(
      'cinematic_domain_scene',
    );
    expect(selectSceneGrammar(metricStory)).toBe('cinematic_domain_scene');
  });

  it('two process tokens without a metric stay cinematic outside the mechanism lens', () => {
    const title = 'Crash and restart loops waste a night of GPU work';
    const summary = 'The run does not resume from a saved checkpoint.';
    expect(
      selectSceneGrammar(
        domainStory({ title, summary, practical: '', takeaway: '', why: '', lens: 'literal_context' }),
      ),
    ).toBe('cinematic_domain_scene');
  });
});

describe('selectSceneGrammar for the mechanism lens (R2.1 / F6 -- at most one diagram per story)', () => {
  it('an exact metric in the headline selects the diagram grammar', () => {
    expect(
      selectSceneGrammar(
        domainStory({
          title: 'Inference cost dropped 82% after the routing change',
          summary: 'The same model now spends less per completed task.',
          practical: '',
          takeaway: '',
          why: '',
          lens: 'mechanism',
        }),
      ),
    ).toBe('deterministic_technical_hybrid');
  });

  it('a metric only in essence claim text selects the diagram grammar', () => {
    expect(
      selectSceneGrammar(
        domainStory({
          essence: { ...DOMAIN_ESSENCE, mechanism: 'Routing cut completed-task cost by 82%.' },
          lens: 'mechanism',
        }),
      ),
    ).toBe('deterministic_technical_hybrid');
  });

  it('a single mention of caching does not select the diagram grammar', () => {
    const input = domainStory({
      title: 'A plugin adds caching for repeated tool calls',
      summary: 'Developers wait less on the second run.',
      practical: '',
      takeaway: '',
      why: '',
      lens: 'mechanism',
    });
    expect(selectSceneGrammar(input)).toBe('cinematic_domain_scene');
  });

  it('two process tokens without a metric select the diagram grammar (C5.3 / F7: the signal is now consulted)', () => {
    const title = 'Crash and restart loops waste a night of GPU work';
    const summary = 'The run does not resume from a saved checkpoint.';
    expect(
      selectSceneGrammar(
        domainStory({ title, summary, practical: '', takeaway: '', why: '', lens: 'mechanism' }),
      ),
    ).toBe('deterministic_technical_hybrid');
  });

  it('an incidental duration in practical does not switch a domain story to the diagram grammar', () => {
    expect(selectSceneGrammar({ ...domainStory(), lens: 'mechanism' })).toBe(
      'cinematic_domain_scene',
    );
  });

  it('fallback source stays source-led even when the headline has a metric', () => {
    expect(
      selectSceneGrammar(
        domainStory({
          title: 'Inference cost dropped 82% after the routing change',
          source: 'fallback',
          lens: 'mechanism',
        }),
      ),
    ).toBe('source_led_fallback');
  });
});

describe('templateIdForSceneGrammar (grammar ↔ Prompt-as-Code template)', () => {
  it('maps hybrid mechanism grammar to infographic-engine', () => {
    expect(
      templateIdForSceneGrammar(
        domainStory({
          title: 'Inference cost dropped 82% after the routing change',
          summary: 'The same model now spends less per completed task.',
          practical: '',
          takeaway: '',
          why: '',
          lens: 'mechanism',
        }),
      ),
    ).toBe('infographic-engine');
  });

  it('does not give literal_context the infographic template', () => {
    expect(templateIdForSceneGrammar(domainStory({ lens: 'literal_context' }))).not.toBe(
      'infographic-engine',
    );
  });
});
