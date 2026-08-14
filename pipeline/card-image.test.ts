import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { loadProviderRegistry } from './providers/registry';
import {
  buildPrompt,
  buildWeeklyPrompt,
  buildEditorialConceptPrompt,
  buildWeeklyContextBlock,
  cleanSceneText,
  conceptPlanningBlockers,
  accentToHex,
  extractWeeklyStoryEntities,
  flattenMetaphorPitch,
  FALLBACK_MOTIF_CLASS,
  headNoun,
  motifFamilyKey,
  parseEditorialEssence,
  parseMetaphorPitches,
  parseWeeklySceneSpec,
  validateMetaphorPitch,
  validateWeeklySceneSpec,
  weeklyFallbackScene,
  weeklySemanticFallbackScene,
  mechanismTokensVisible,
  pitchRenderableBlob,
  type EditorialEssence,
  WEEKLY_PROMPT_POLICY,
  DEFAULT_CF_IMAGE_MODEL,
  estimateCloudflareImageCostUsd,
  fallbackIllustrationMotif,
  fallbackScene,
  generateEditorialIllustration,
  generateWeeklyReportageIllustrations,
  hueName,
  IMG_H,
  IMG_W,
  isFlux2MultipartModel,
  megapixelsForDimensions,
  negativePrompt,
  renderFallbackEditorialIllustration,
  sceneBrief,
  SCHNELL_MODEL,
  seedFromString,
  weeklyReportageSceneBrief,
  weeklyReportageSceneBriefs,
} from './card-image';

// Wraps the real loadProviderRegistry (pass-through by default) so existing
// tests keep exercising real env-key resolution unchanged, while new tests
// below can assert call count/args or override it for a specific case.
vi.mock('./providers/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./providers/registry')>();
  return { ...actual, loadProviderRegistry: vi.fn(actual.loadProviderRegistry) };
});

afterEach(() => {
  vi.mocked(loadProviderRegistry).mockClear();
});

describe('DEFAULT_CF_IMAGE_MODEL', () => {
  it('uses Cloudflare FLUX.2 klein-9b by default (not Leonardo)', () => {
    expect(DEFAULT_CF_IMAGE_MODEL).toBe('@cf/black-forest-labs/flux-2-klein-9b');
    expect(DEFAULT_CF_IMAGE_MODEL).not.toContain('leonardo');
    expect(SCHNELL_MODEL).toBe('@cf/black-forest-labs/flux-1-schnell');
  });
});

describe('FLUX.2 cost helpers', () => {
  it('bills at least 1 megapixel and ceils fractional MPs', () => {
    expect(megapixelsForDimensions(IMG_W, IMG_H)).toBe(1);
    expect(megapixelsForDimensions(2048, 2048)).toBe(5);
  });

  it('estimates klein pricing from first + subsequent MP rates', () => {
    expect(estimateCloudflareImageCostUsd(IMG_W, IMG_H, {})).toBe(0.015);
    expect(
      estimateCloudflareImageCostUsd(2048, 2048, {
        CLOUDFLARE_IMAGE_USD_FIRST_MP: '0.015',
        CLOUDFLARE_IMAGE_USD_NEXT_MP: '0.002',
      }),
    ).toBe(0.023);
  });

  it('falls back to defaults when env rates are invalid', () => {
    expect(
      estimateCloudflareImageCostUsd(IMG_W, IMG_H, {
        CLOUDFLARE_IMAGE_USD_FIRST_MP: 'nope',
        CLOUDFLARE_IMAGE_USD_NEXT_MP: '-1',
      }),
    ).toBe(0.015);
  });

  it('detects multipart FLUX.2 model ids', () => {
    expect(isFlux2MultipartModel('@cf/black-forest-labs/flux-2-klein-9b')).toBe(true);
    expect(isFlux2MultipartModel('@cf/black-forest-labs/flux-2-dev')).toBe(true);
    expect(isFlux2MultipartModel(SCHNELL_MODEL)).toBe(false);
  });
});

describe('generateEditorialIllustration ladder', () => {
  const originalFetch = globalThis.fetch;
  const pngBytes = Buffer.alloc(2048, 7);

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function jsonImageResponse() {
    return new Response(JSON.stringify({ result: { image: pngBytes.toString('base64') } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('generates via FLUX.2 klein multipart and reports estimated cost', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('flux-2-klein-9b')) return jsonImageResponse();
      return new Response('fail', { status: 500 });
    }) as typeof fetch;

    const result = await generateEditorialIllustration(
      {
        title: 'MCP agent orchestrates workflows',
        summary: 'Autonomous agents coordinate tools',
        seedKey: 'story-1',
      },
      {
        geminiApiKey: '',
        cloudflareAccountId: 'acc',
        cloudflareApiToken: 'tok',
      },
    );

    expect(result).not.toBeNull();
    expect(result!.provider).toBe('cloudflare');
    expect(result!.model).toBe(DEFAULT_CF_IMAGE_MODEL);
    expect(result!.costSource).toBe('estimated');
    expect(result!.estimatedCostUsd).toBe(0.015);
    expect(result!.bytes.length).toBeGreaterThan(1000);
    expect(result!.scene).toBeTruthy();
    expect(result!.sceneSource).toBe('fallback');
    expect(result!.positivePrompt).toContain('Scene:');
    expect(result!.positivePrompt).toContain(result!.scene!);
    expect(result!.negativePrompt).toContain('glowing brain');
    const calledUrls = vi.mocked(globalThis.fetch).mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.includes('flux-2-klein-9b'))).toBe(true);
    const kleinCall = vi
      .mocked(globalThis.fetch)
      .mock.calls.find((call) => String(call[0]).includes('flux-2-klein-9b'));
    expect(kleinCall?.[1]?.body).toBeInstanceOf(FormData);
  });

  it('spills over to FLUX-1-schnell when the primary CF model fails', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('flux-2-klein-9b')) return new Response('busy', { status: 429 });
      if (url.includes('flux-1-schnell')) return jsonImageResponse();
      return new Response('fail', { status: 500 });
    }) as typeof fetch;

    const result = await generateEditorialIllustration(
      { title: 'Security CVE breach', summary: 'Attackers exploit', seedKey: 'story-2' },
      {
        geminiApiKey: '',
        cloudflareAccountId: 'acc',
        cloudflareApiToken: 'tok',
      },
    );

    expect(result?.provider).toBe('cloudflare');
    expect(result?.model).toBe(SCHNELL_MODEL);
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to Pollinations when Cloudflare is unset', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('pollinations.ai')) {
        return new Response(pngBytes, { status: 200, headers: { 'content-type': 'image/jpeg' } });
      }
      return new Response('fail', { status: 500 });
    }) as typeof fetch;

    const result = await generateEditorialIllustration(
      { title: 'Funding round', summary: 'Startup raises billion', seedKey: 'story-3' },
      { geminiApiKey: '' },
    );

    expect(result?.provider).toBe('pollinations');
    expect(result?.estimatedCostUsd).toBe(0);
  });

  it('renders the local SVG fallback when every remote provider fails', async () => {
    globalThis.fetch = vi.fn(async () => new Response('down', { status: 503 })) as typeof fetch;

    const result = await generateEditorialIllustration(
      {
        title: 'Local on-device Gemma LLM',
        summary: 'Run offline privacy',
        seedKey: 'story-4',
        fallbackToLocal: true,
      },
      {
        geminiApiKey: '',
        cloudflareAccountId: 'acc',
        cloudflareApiToken: 'tok',
      },
    );

    expect(result?.provider).toBe('local');
    expect(result?.model).toBe('fallback-svg');
    expect(result?.estimatedCostUsd).toBe(0);
    await expect(sharp(result!.bytes).metadata()).resolves.toMatchObject({
      width: 1280,
      height: 720,
    });
  });

  it('returns null without local fallback when providers fail', async () => {
    globalThis.fetch = vi.fn(async () => new Response('down', { status: 503 })) as typeof fetch;

    const result = await generateEditorialIllustration(
      { title: 'Anything', summary: 'Else', seedKey: 'story-5' },
      { geminiApiKey: '', cloudflareAccountId: 'acc', cloudflareApiToken: 'tok' },
    );
    expect(result).toBeNull();
  });
});

describe('hueName', () => {
  it('maps category accent hexes to prompt-friendly colour words', () => {
    expect(hueName('#e24b4a')).toBe('crimson red');
    expect(hueName('#f0c040')).toBe('amber orange');
    expect(hueName('#5dcaa5')).toBe('emerald green');
    expect(hueName('#5bc9f0')).toBe('teal');
    expect(hueName('#ffd000')).toBe('golden yellow');
    expect(hueName('#00a0ff')).toBe('cyan');
    expect(hueName('#5000ff')).toBe('electric blue');
    expect(hueName('#e000ff')).toBe('violet purple');
    expect(hueName('#ff00a0')).toBe('magenta pink');
  });

  it('falls back to a brand-default cool tone for achromatic / invalid input', () => {
    expect(hueName('#888888')).toBe('cool cyan');
    expect(hueName(null)).toBe('cool cyan');
    expect(hueName('not-a-hex')).toBe('cool cyan');
  });
});

describe('seedFromString', () => {
  it('is deterministic and bounded', () => {
    expect(seedFromString('noam-shazeer')).toBe(seedFromString('noam-shazeer'));
    const seed = seedFromString('noam-shazeer');
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(1_000_000);
    expect(Number.isInteger(seed)).toBe(true);
  });

  it('differs across distinct slugs', () => {
    expect(seedFromString('a')).not.toBe(seedFromString('b'));
  });
});

describe('buildPrompt', () => {
  it('makes the story scene dominant, with a light brand thread + accent', () => {
    const prompt = buildPrompt('violet purple', 'a cracked padlock over a server rack');
    expect(prompt).toContain('violet purple');
    expect(prompt).toContain('a cracked padlock over a server rack');
    expect(prompt).toContain('editorial');
    expect(prompt).toMatch(/no text/i);
    expect(prompt).toContain('16:9');
    // Never invite masthead/headline painting (FLUX hallucinates gibberish).
    expect(prompt.toLowerCase()).not.toContain('overlaid headline');
    expect(prompt.toLowerCase()).toContain('no typography');
    // The scene leads (placed after the brand thread), so it is not buried.
    expect(prompt.indexOf('cracked padlock')).toBeGreaterThan(prompt.indexOf('editorial'));
  });
});

describe('negativePrompt', () => {
  it('bans the over-used AI clichés that made cards look identical', () => {
    const neg = negativePrompt();
    expect(neg).toContain('glowing brain');
    expect(neg).toContain('circuit board');
    expect(neg).toContain('text');
    expect(neg).toContain('masthead');
    expect(neg).toContain('headline');
    expect(neg).toContain('anonymous server aisle');
    expect(neg).toContain('lone laptop on desk');
  });
});

describe('fallbackScene', () => {
  it('picks a concrete, on-topic scene for every keyword category', () => {
    expect(fallbackScene('Critical CVE lets attackers breach the server')).toContain('padlock');
    expect(fallbackScene('Startup raises $200 billion in funding round')).toContain('coin');
    expect(fallbackScene('New MCP agent orchestrates multi-step workflows')).toContain('robotic');
    expect(fallbackScene('GPT-5 model launch benchmark results')).toContain('stage');
    expect(fallbackScene('Run Gemma 4 as a local on-device LLM offline')).toContain('laptop');
    expect(fallbackScene('Cut token cost and latency with this optimization')).toContain('gauge');
    expect(fallbackScene('AI medical scan and MRI vision analysis')).toContain('lightbox');
  });

  it('uses isolation-breakout metaphor for network misconfig / post-mortem stories', () => {
    const postMortem = fallbackScene(
      'Anthropic Post-Mortem: Network misconfigurations let an evaluation agent reach external systems',
    );
    expect(postMortem.toLowerCase()).toContain('sandbox');
    expect(postMortem.toLowerCase()).toContain('network');
    expect(postMortem.toLowerCase()).not.toContain('laptop');
    expect(postMortem.toLowerCase()).not.toContain('reveal stage');
  });

  it('prefers cryptographic seal over model-launch stage for Mythos cryptanalysis', () => {
    const mythos = fallbackScene(
      'Claude Mythos Preview: Early access model shows unexpected cryptanalysis capabilities',
    );
    expect(mythos.toLowerCase()).toMatch(/padlock|cryptographic seal/);
    expect(mythos.toLowerCase()).not.toContain('reveal stage');
  });

  it('returns a sensible default and never the banned brain cliché', () => {
    const generic = fallbackScene('A developer shares thoughts on keyboard layouts and coffee');
    expect(generic.toLowerCase()).not.toContain('brain');
    expect(generic).toContain('workstation');
    expect(generic.length).toBeGreaterThan(10);
  });
});

describe('renderFallbackEditorialIllustration', () => {
  it('renders a valid, deterministic 16:9 memory visual without a remote provider', async () => {
    const input = {
      title: 'Google Cloud Releases Always-On Memory Agent Powered by Gemini Flash-Lite',
      summary: 'A background agent consolidates memory into SQLite instead of a RAG database.',
      seedKey: 'weekly-memory-agent',
    };
    expect(fallbackIllustrationMotif(`${input.title} ${input.summary}`)).toBe('memory');
    const [first, second] = await Promise.all([
      renderFallbackEditorialIllustration(input),
      renderFallbackEditorialIllustration(input),
    ]);
    expect(first.equals(second)).toBe(true);
    expect(first.subarray(1, 4).toString()).toBe('PNG');
    await expect(sharp(first).metadata()).resolves.toMatchObject({ width: 1280, height: 720 });
  });
});

describe('sceneBrief', () => {
  it('returns the default scene without any network call when there is no context', async () => {
    const { scene, source } = await sceneBrief('', '', { geminiApiKey: 'unused' });
    expect(scene).toContain('workstation');
    expect(source).toBe('fallback');
  });
});

// --- Weekly Digest editorial-concept illustrations (essence → metaphor) ---

function semanticEssence(
  input: Pick<
    EditorialEssence,
    'essence' | 'mustFeel' | 'forbiddenCliches' | 'mechanism' | 'readerTest'
  > &
    Partial<EditorialEssence>,
): EditorialEssence {
  return {
    storyContext: input.essence,
    meaning: input.essence,
    consequence: input.readerTest,
    visualThesis: `${input.mechanism} leads to ${input.readerTest}`,
    ...input,
  };
}

describe('cleanSceneText', () => {
  it('unwraps art-director JSON wrappers so keys never reach the image prompt', () => {
    expect(
      cleanSceneText('{"frame":"edge aisle with a technician sliding a server blade into a rack"}'),
    ).toBe('edge aisle with a technician sliding a server blade into a rack');
  });

  it('unwraps markdown-fenced JSON and common alternate keys', () => {
    expect(
      cleanSceneText('```json\n{"scene":"hand paused over a trackpad under cool cyan glow"}\n```'),
    ).toBe('hand paused over a trackpad under cool cyan glow');
  });

  it('leaves a plain phrase untouched (aside from whitespace collapse)', () => {
    expect(cleanSceneText('  researcher hand hovering over a keyboard  ')).toBe(
      'researcher hand hovering over a keyboard',
    );
  });
});

describe('weeklyReportageSceneBrief', () => {
  it('returns the default scene without any network call when there is no context', async () => {
    const { scene, source } = await weeklyReportageSceneBrief(
      { headline: '', summary: '' },
      { geminiApiKey: 'unused' },
    );
    expect(scene).toContain('workstation');
    expect(source).toBe('fallback');
  });

  it('uses a conceptual weekly fallback (not daily metaphor padlocks) when providers are unconfigured', async () => {
    const { scene, source } = await weeklyReportageSceneBrief(
      { headline: 'Critical CVE lets attackers breach the server', summary: '' },
      { geminiApiKey: '' },
    );
    expect(source).toBe('fallback');
    expect(scene.toLowerCase()).not.toContain('padlock');
    expect(scene.toLowerCase()).toMatch(/vault|alarm|crack|security/);
  });
});

describe('weekly essence + metaphor gates', () => {
  it('parses essence JSON', () => {
    const essence = parseEditorialEssence(
      '{"context":"Codex generated a 3D game","meaning":"speed arrived before verification","essence":"Shipping speed outran quality","mechanism":"rushed game build before QA","consequence":"unfinished defects reached the playable build","visual_thesis":"rushed assembly exposes unfinished defects","reader_test":"grasp: facade shipped first","must_feel":"uneasy contrast","forbidden_cliches":["glowing brain"]}',
    );
    expect(essence?.essence).toMatch(/speed outran quality/i);
    expect(essence?.mechanism).toMatch(/rushed game build/i);
    expect(essence?.storyContext).toMatch(/Codex/i);
    expect(essence?.meaning).toMatch(/verification/i);
    expect(essence?.consequence).toMatch(/defects/i);
    expect(essence?.visualThesis).toMatch(/assembly/i);
    expect(essence?.readerTest).toMatch(/facade shipped/i);
    expect(essence?.forbiddenCliches).toContain('glowing brain');
  });

  it('falls back mechanism from why when JSON omits it', () => {
    const essence = parseEditorialEssence(
      '{"essence":"Agents need durable recovery","must_feel":"vigilance","forbidden_cliches":[]}',
      {
        headline: 'Muse crash-proof agents',
        summary: 'Unsupervised coding with durable recovery',
        why: 'crash-proof event log that resumes after failure',
      },
    );
    expect(essence?.mechanism).toMatch(/event log/i);
    expect(essence?.readerTest).toMatch(/event log/i);
    expect(mechanismTokensVisible('', 'anything')).toBe(true);
  });

  it('passes approved context, benefit, limitation, and research risk as separate evidence', () => {
    const context = buildWeeklyContextBlock(
      {
        headline: 'Agent ships a new runtime',
        summary: 'The runtime resumes work after crashes.',
        why: 'Teams lose less work during long-running jobs.',
        practical: 'Developers can resume a failed automation.',
        limitation: 'Only one workload was tested.',
        takeaway: 'Durability matters more than a flashy demo.',
        claimsExcerpt: 'A persisted event log records each completed step.',
        researchRisks: 'No independent production benchmark yet.',
        editorsView: 'This could make unattended jobs operationally safer.',
        editorialAngle: 'Focus on recovery, not autonomy hype.',
      },
      ['runtime', 'event log'],
    );
    expect(context).toContain('SOURCE STORY');
    expect(context).toContain('Reader benefit / practical use');
    expect(context).toContain('Limitation / counterweight');
    expect(context).toContain('Research risks');
    expect(context).toContain('interpretation, NOT a reported fact');
  });

  it('parses metaphor pitches and flattens subject-first', () => {
    const pitches = parseMetaphorPitches(
      JSON.stringify({
        metaphors: [
          {
            title: 'Facade vs backstage',
            subject: 'polished game character on a lit stage',
            action: 'hiding unfinished props behind a curtain',
            setting: 'theatre with clear left-right spatial divide',
            props: ['curtain', 'missing-texture crates'],
            composition: 'dual_contrast',
            motif_class: 'theatrical_reveal',
            subject_kind: 'character',
            why_it_fits: 'speed shipped a facade before quality caught up',
            story_anchor: 'Codex 3D game character and build props',
            visible_mechanism: 'polished facade assembled before QA inspection',
            visible_consequence: 'unfinished missing-texture props exposed behind the curtain',
          },
        ],
      }),
    );
    expect(pitches[0]?.composition).toBe('dual_contrast');
    expect(pitches[0]?.motifClass).toBe('theatrical_reveal');
    expect(pitches[0]?.subjectKind).toBe('character');
    expect(pitches[0]?.visibleMechanism).toMatch(/QA inspection/i);
    expect(pitches[0]?.visibleConsequence).toMatch(/unfinished/i);
    expect(flattenMetaphorPitch(pitches[0]!).toLowerCase()).toContain('spatial divide');
    expect(flattenMetaphorPitch(pitches[0]!)).toContain(
      'unfinished missing-texture props exposed behind the curtain',
    );
  });

  it('assigns the three independent concept lenses, including a retry subset fallback', () => {
    const rows = JSON.stringify({
      metaphors: [
        { subject: 'a tutor deciding whether to interrupt a student' },
        { subject: 'a balance gate opening only at the moment help is useful' },
        { subject: 'two learning paths ending at visibly different outcomes' },
      ],
    });
    expect(parseMetaphorPitches(rows).map((pitch) => pitch.lens)).toEqual([
      'literal_context',
      'mechanism',
      'consequence',
    ]);
    expect(
      parseMetaphorPitches(
        JSON.stringify({ metaphors: [{ subject: 'a result diverging after timely help' }] }),
        ['consequence'],
      )[0]?.lens,
    ).toBe('consequence');
  });

  it('allows dual_contrast when spatial-divide language is present', () => {
    const errors = validateMetaphorPitch(
      {
        title: 'Facade',
        subject: 'polished Codex game character on stage left',
        action: 'contrasting unfinished props backstage right',
        setting: 'one continuous photograph with a curtain spatial divide',
        props: ['curtain'],
        composition: 'dual_contrast',
        whyItFits: 'polished facade vs broken backstage — speed outran quality',
        motifClass: 'theatrical_reveal',
        subjectKind: 'character',
        storyAnchor: 'Codex 3D game character and build props',
        visibleMechanism: 'polished game facade shipped before quality caught up',
        visibleConsequence: 'unfinished quality defects hidden behind the polished facade',
      },
      semanticEssence({
        storyContext: 'Codex generated a rushed 3D game build before QA.',
        essence: 'Speed outran quality in a rushed 3D game build',
        mustFeel: 'uneasy',
        forbiddenCliches: [],
        mechanism: 'polished game facade shipped before quality caught up',
        consequence: 'unfinished quality defects remain hidden behind the polished facade',
        readerTest: 'After seeing the image, grasp: facade shipped ahead of quality',
      }),
      ['Codex', '3D game'],
    );
    expect(errors).toEqual([]);
  });

  it('rejects sibling motif reuse, character budget, and dual_contrast digest cap', () => {
    const siblings = [
      {
        motifClass: 'anthropomorphic_guardian',
        subjectKind: 'character',
        composition: 'dual_contrast' as const,
        sceneSummary: 'clay golem guarding a sealed journal in a vault',
      },
      {
        motifClass: 'human_operator',
        subjectKind: 'character',
        composition: 'single' as const,
        sceneSummary: 'a human operator reconnecting a stopped assembly line',
      },
    ];
    const essence = semanticEssence({
      essence: 'Unsupervised agents stay reliable via durable memory',
      mustFeel: 'vigilance',
      forbiddenCliches: [],
      mechanism: 'durable memory ledger that keeps the agent honest',
      readerTest: 'grasp: durable memory keeps unsupervised agents reliable',
    });
    const reuse = validateMetaphorPitch(
      {
        title: 'Guardian',
        subject: 'another tireless golem watching a ledger',
        action: 'standing watch',
        setting: 'stone vault',
        props: ['journal'],
        composition: 'single',
        whyItFits: 'durable memory keeps the agent honest',
        motifClass: 'anthropomorphic_guardian',
        subjectKind: 'character',
      },
      essence,
      ['agent'],
      siblings,
    );
    expect(reuse).toContain('sibling_motif_class_reuse');
    expect(reuse).toContain('character_budget');

    const dualCap = validateMetaphorPitch(
      {
        title: 'Split plant',
        subject: 'tiny chat orb left of industrial heat furnace',
        action: 'dwarfed by wasted wattage',
        setting: 'one continuous photograph with left-right spatial divide',
        props: ['heat haze'],
        composition: 'dual_contrast',
        whyItFits: 'tiny chat vs industrial heat — invisible energy waste',
        motifClass: 'thermal_waste',
        subjectKind: 'object',
      },
      semanticEssence({
        essence: 'Agentic coding burns vastly more energy than a chat prompt',
        mustFeel: 'waste',
        forbiddenCliches: [],
        mechanism: 'agentic coding loops that burn energy vs a tiny chat prompt',
        readerTest: 'grasp: agentic loops waste far more energy than chat',
      }),
      ['energy'],
      siblings,
    );
    expect(dualCap).toContain('dual_contrast_digest_cap');
  });

  it('fallback briefs share a motif class so the sibling validator sees them as duplicates', () => {
    const essence = semanticEssence({
      essence: 'Server-side tools become usable from the command line.',
      mustFeel: 'precise connection',
      forbiddenCliches: [],
      mechanism: 'A CLI plugin exposes server-side tools through a local command.',
      readerTest: 'grasp: server-side tools now plug into the command line',
    });
    const fallbackPitch = {
      title: 'Literal context',
      subject: 'grounded tableau of the command-line plugin',
      action: 'showing the mechanism at work',
      setting: 'one continuous workshop',
      props: ['adapter card'],
      composition: 'single' as const,
      whyItFits: 'Fallback lens preserving the approved semantic contract.',
      motifClass: FALLBACK_MOTIF_CLASS,
      subjectKind: 'environment' as const,
    };
    const duplicate = validateMetaphorPitch(fallbackPitch, essence, ['Claude', 'plugin'], [
      {
        motifClass: FALLBACK_MOTIF_CLASS,
        subjectKind: 'process',
        sceneSummary: 'exposed process cutaway of the same essence',
      },
    ]);
    expect(duplicate).toContain('sibling_motif_class_reuse');
  });

  it('two motif classes from the same material and setting count as one family', () => {
    expect(headNoun('tool cabinet')).toBe('cabinet');
    expect(headNoun('workshop bench')).toBe('bench');
    expect(headNoun('tool cabinets')).toBe('cabinet');
    const cabinet = {
      title: 'Single Slot Tool Cabinet',
      subject: 'a single slot tool cabinet',
      action: 'holding one command flag in the only open bay',
      setting: 'workshop bench',
      props: ['one brass flag'],
      composition: 'single' as const,
      whyItFits: 'One command flag is the only way into the tools.',
      motifClass: 'single_slot_cabinet',
      subjectKind: 'object' as const,
      storyAnchor: 'one command flag in a single cabinet bay',
      visibleMechanism: 'the flag seats into the only open cabinet slot',
      visibleConsequence: 'every other tool stays locked behind the closed bays',
    };
    const carousel = {
      title: 'Single Shaft Tool Carousel',
      subject: 'a single shaft tool carousel',
      action: 'turning every tool from one fragile axle',
      setting: 'workshop bench',
      props: ['one brass shaft'],
      composition: 'single' as const,
      whyItFits: 'One command flag is the only way into the tools.',
      motifClass: 'single_shaft_carousel',
      subjectKind: 'object' as const,
      storyAnchor: 'one command flag turning the carousel shaft',
      visibleMechanism: 'the shaft drives every tool from a single axle',
      visibleConsequence: 'the whole rack fails when that one shaft snaps',
    };
    expect(motifFamilyKey(cabinet)).toEqual(['cabinet', 'bench', 'object']);
    expect(motifFamilyKey(carousel)).toEqual(['carousel', 'bench', 'object']);
    const family = validateMetaphorPitch(
      carousel,
      semanticEssence({
        storyContext: 'A CLI plugin exposes server-side tools through one command flag.',
        essence: 'One command flag is the only way into the tools.',
        mustFeel: 'fragility',
        forbiddenCliches: [],
        mechanism: 'A single command flag drives every attached tool.',
        consequence: 'If that flag fails, the whole tool rack is unusable.',
        visualThesis: 'One shaft or slot holds every tool on a workshop bench.',
        readerTest: 'grasp: one command flag is a single point of failure',
      }),
      ['command flag', 'plugin'],
      [
        {
          motifClass: cabinet.motifClass,
          subjectKind: cabinet.subjectKind,
          sceneSummary: `${cabinet.subject} ${cabinet.setting}`,
          subject: cabinet.subject,
          setting: cabinet.setting,
        },
      ],
    );
    expect(family).toContain('sibling_motif_family_reuse');
    expect(family).not.toContain('sibling_motif_class_reuse');
  });

  it('rejects diamond-vs-grinder when mechanism is an event log', () => {
    const errors = validateMetaphorPitch(
      {
        title: 'Blind Excavation',
        subject: 'a flawless diamond pressed against an industrial grinder',
        action: 'trusting the wheel without a resume checkpoint',
        setting: 'dark workshop',
        props: ['sparks', 'grinder wheel'],
        composition: 'single',
        whyItFits: 'blind trust in a polished surface',
        motifClass: 'blind_excavation',
        subjectKind: 'object',
      },
      semanticEssence({
        essence: 'Crash-proof agents need a durable event log',
        mustFeel: 'reliability under failure',
        forbiddenCliches: [],
        mechanism: 'crash-proof event log that resumes after failure',
        readerTest: 'After seeing the image, grasp: durable event log resumes after crash',
      }),
      ['Muse', 'event log'],
    );
    expect(errors).toContain('mechanism_not_visible');
    expect(
      mechanismTokensVisible(
        'crash-proof event log that resumes after failure',
        'flawless diamond against industrial grinder blind trust',
      ),
    ).toBe(false);
    expect(
      mechanismTokensVisible(
        'crash-proof event log that resumes after failure',
        'sealed event log ledger that resumes after a crash failure',
      ),
    ).toBe(true);
  });

  it('does not let why_it_fits text satisfy a mechanism that is absent from the rendered scene', () => {
    const pitch = {
      title: 'Decorative turbine',
      subject: 'a polished turbine under a cyan spotlight',
      action: 'rotating in an empty gallery',
      setting: 'dark exhibition hall',
      props: ['one steel pedestal'],
      composition: 'single' as const,
      whyItFits: 'A crash-proof event log resumes the agent after failure.',
      motifClass: 'decorative_turbine',
      subjectKind: 'object' as const,
      storyAnchor: 'generic steel turbine',
      visibleMechanism: 'turbine blades rotate around a central axle',
      visibleConsequence: 'a pool of cyan light reaches the floor',
    };
    const semantic = semanticEssence({
      essence: 'A durable event log makes the agent recoverable',
      mustFeel: 'resilience',
      forbiddenCliches: [],
      mechanism: 'crash-proof event log that resumes after failure',
      consequence: 'failed automation resumes without losing completed work',
      readerTest: 'grasp: the event log preserves completed work through a crash',
    });
    expect(pitchRenderableBlob(pitch)).not.toContain('event log');
    expect(validateMetaphorPitch(pitch, semantic, ['event log'])).toContain(
      'mechanism_not_visible',
    );
  });

  it('treats semantic token mismatch as a vision advisory while keeping structural blockers fatal', () => {
    expect(
      conceptPlanningBlockers([
        'story_anchor_not_grounded_in_context',
        'metaphor does not clearly argue the essence',
        'mechanism_not_visible',
        'consequence_not_visible',
        'scene_missing_story_context',
      ]),
    ).toEqual([]);
    expect(
      conceptPlanningBlockers([
        'story_anchor_not_grounded_in_context',
        'sibling_scene_echo',
        'opaque_abstraction_not_literal_to_story',
      ]),
    ).toEqual(['sibling_scene_echo', 'opaque_abstraction_not_literal_to_story']);
  });

  it('accepts physical cause-and-effect language grounded in the visual thesis', () => {
    const errors = validateMetaphorPitch(
      {
        title: 'Meter cascade',
        subject: 'a blank ceramic chat token starting a chain of analog electricity meters',
        action: 'each mechanical relay turns the next meter faster',
        setting: 'one continuous dark industrial workbench',
        props: ['unmarked relays', 'power cables', 'analog meter needles'],
        composition: 'single',
        whyItFits: 'The small request hides repeated infrastructure work and accumulated energy.',
        motifClass: 'meter_cascade',
        subjectKind: 'process',
        storyAnchor: 'agentic coding loop represented by one blank chat token',
        visibleMechanism: 'a chain reaction through repeated model-call relays and tool cables',
        visibleConsequence: 'the chain of electricity meters spin faster at the final meter',
      },
      semanticEssence({
        storyContext: 'Agentic coding loops repeatedly invoke models and tools.',
        meaning: 'A simple interface hides accumulating infrastructure work.',
        essence: 'One chat-like request can conceal a much larger electricity cost.',
        mustFeel: 'uneasy accumulation',
        forbiddenCliches: [],
        mechanism: 'Repeated planning, model calls, tool execution, and retries multiply work.',
        consequence: 'Teams should account for loop count and electricity use.',
        visualThesis: 'A blank chat token causes a chain of electricity meters to spin faster.',
        readerTest: 'grasp: repeated hidden work accumulates electricity use',
      }),
      ['agentic coding', 'energy'],
    );

    expect(errors).toEqual([]);
  });

  it('rejects a topic-only anchor that omits the source actor or system', () => {
    const errors = validateMetaphorPitch(
      {
        title: 'Generic energy loop',
        subject: 'a water wheel turning an electricity meter',
        action: 'circulating water through a pump',
        setting: 'clear acrylic tank',
        props: ['pipes', 'meter'],
        composition: 'single',
        whyItFits: 'The loop consumes electricity.',
        motifClass: 'water_loop',
        subjectKind: 'process',
        storyAnchor: 'a closed-loop electric water pump',
        visibleMechanism: 'the pump repeatedly circulates water through the wheel',
        visibleConsequence: 'the electricity meter spins while the wheel repeats',
      },
      semanticEssence({
        storyContext: 'An agentic coding loop repeatedly invokes models and developer tools.',
        meaning: 'The interface hides repeated infrastructure work.',
        essence: 'Agentic coding can conceal accumulated electricity use.',
        mustFeel: 'uneasy accumulation',
        forbiddenCliches: [],
        mechanism: 'Repeated model calls and tool execution multiply work.',
        consequence: 'Electricity use accumulates across the hidden loop.',
        visualThesis: 'A coding-agent loop drives repeated tools and an accelerating meter.',
        readerTest: 'grasp: repeated agent work accumulates energy use',
      }),
      ['agentic coding loop', 'electricity'],
    );

    expect(errors).toContain('story_anchor_not_grounded_in_context');
  });

  it('rejects high-speed / motion-blur language in the pitch', () => {
    const errors = validateMetaphorPitch(
      {
        title: 'Loom',
        subject: 'a high-speed loom with motion blur smeared shuttles',
        action: 'streaking across the frame',
        setting: 'mill floor',
        props: ['blurred soft lens'],
        composition: 'single',
        whyItFits: 'build blind to its own bugs while racing',
        motifClass: 'blind_loom',
        subjectKind: 'object',
      },
      semanticEssence({
        essence: 'Agents build blind to their own bugs',
        mustFeel: 'uneasy speed',
        forbiddenCliches: [],
        mechanism: 'build process blind to its own bugs',
        readerTest: 'grasp: the build cannot see its own defects',
      }),
      ['Codex'],
    );
    expect(errors.some((e) => /motion-blur|high-speed/i.test(e))).toBe(true);
  });

  it('rejects paper-heap sludge and terminal/UI collage language', () => {
    const sludge = validateMetaphorPitch(
      {
        title: 'Papers',
        subject: 'a tall stack of papers and transcript heap',
        action: 'towering on a desk',
        setting: 'office',
        props: ['melted warped pages'],
        composition: 'single',
        whyItFits: 'energy waste somehow',
        motifClass: 'paper_heap',
        subjectKind: 'object',
      },
      semanticEssence({
        essence: 'Agentic work burns energy invisibly',
        mustFeel: 'waste',
        forbiddenCliches: [],
        mechanism: 'invisible energy waste from agentic work',
        readerTest: 'grasp: agentic work burns energy invisibly',
      }),
      ['Stripe', 'energy'],
    );
    expect(sludge.some((e) => /sludge|paper/i.test(e))).toBe(true);

    const bad = parseWeeklySceneSpec(
      '{"subject":"split-screen monitor","action":"showing terminal npx output","setting":"office desk","props":[],"must_include":[]}',
    )!;
    expect(validateWeeklySceneSpec(bad, ['Codex', '3D game']).length).toBeGreaterThan(0);
  });

  it('a command-line story may use the word terminal for a physical object', () => {
    const errors = validateMetaphorPitch(
      {
        title: 'Teleprinter adapter',
        subject: 'a brass adapter card being pushed into a 1970s teleprinter terminal',
        action: 'the card is half inserted into the expansion slot',
        setting: 'one continuous workshop bench in window light',
        props: ['worn enamel housing', 'contact strip'],
        composition: 'single',
        whyItFits: 'Server-side tools now connect through the command line.',
        motifClass: 'adapter_cartridge',
        subjectKind: 'object',
        storyAnchor: 'Claude server-side tools arriving as a command-line plugin',
        visibleMechanism:
          'a brass adapter card seats into the teleprinter terminal expansion slot',
        visibleConsequence: 'the old command line can now run the newly connected tools',
      },
      semanticEssence({
        storyContext:
          "Simon Willison's llm-anthropic plugin brings Claude server-side tools to the command line.",
        meaning: 'Tools that lived on the server now run from a local CLI.',
        essence: 'Server-side tools become usable from the command line.',
        mustFeel: 'precise connection',
        forbiddenCliches: [],
        mechanism: 'A CLI plugin exposes server-side tools through a local command.',
        consequence: 'Developers invoke those tools from the command line without a separate service.',
        visualThesis:
          'A brass adapter card connecting into a teleprinter terminal lets the old system run new tools.',
        readerTest: 'grasp: server-side tools now plug into the command line',
      }),
      ['Claude', 'plugin', 'command line'],
    );
    expect(errors).not.toContain('banned UI, collage, or stock-metaphor language');
    expect(errors).toEqual([]);
  });

  it('still rejects UI collage language when the story is literally about a terminal', () => {
    const windowShot = validateMetaphorPitch(
      {
        title: 'Terminal window',
        subject: 'a glowing terminal window with npx output',
        action: 'showing split-screen IDE chrome',
        setting: 'office desk',
        props: ['readable UI'],
        composition: 'single',
        whyItFits: 'The plugin exposes server-side tools on the command line.',
        motifClass: 'terminal_window_ui',
        subjectKind: 'object',
        storyAnchor: 'Claude server-side tools in a command-line plugin',
        visibleMechanism: 'npx output fills a terminal window on the desk',
        visibleConsequence: 'the developer reads the command line from the screen',
      },
      semanticEssence({
        storyContext:
          "Simon Willison's llm-anthropic plugin brings Claude server-side tools to the command line.",
        essence: 'Server-side tools become usable from the command line.',
        mustFeel: 'precise connection',
        forbiddenCliches: [],
        mechanism: 'A CLI plugin exposes server-side tools through a local command.',
        readerTest: 'grasp: server-side tools now plug into the command line',
      }),
      ['Claude', 'plugin', 'command line'],
    );
    expect(windowShot).toContain('banned UI, collage, or stock-metaphor language');

    const sludgeOnCli = validateMetaphorPitch(
      {
        title: 'Glowing brain',
        subject: 'a glowing brain above a cracked padlock',
        action: 'floating over comic panel collage',
        setting: 'void',
        props: ['neural-network mesh'],
        composition: 'single',
        whyItFits: 'The plugin exposes server-side tools on the command line.',
        motifClass: 'glowing_brain',
        subjectKind: 'object',
        storyAnchor: 'Claude server-side tools in a command-line plugin',
        visibleMechanism: 'a glowing brain unlocks the cracked padlock',
        visibleConsequence: 'the command line tools spill out as holograms',
      },
      semanticEssence({
        storyContext:
          "Simon Willison's llm-anthropic plugin brings Claude server-side tools to the command line.",
        essence: 'Server-side tools become usable from the command line.',
        mustFeel: 'precise connection',
        forbiddenCliches: [],
        mechanism: 'A CLI plugin exposes server-side tools through a local command.',
        readerTest: 'grasp: server-side tools now plug into the command line',
      }),
      ['Claude', 'plugin', 'command line'],
    );
    expect(sludgeOnCli).toContain('banned UI, collage, or stock-metaphor language');
  });

  it('rejects polished but opaque data-flow machinery when it is not literal news context', () => {
    const errors = validateMetaphorPitch(
      {
        title: 'Tube network',
        subject: 'a pneumatic tube network carrying sealed canisters',
        action: 'routing each canister through generic pipework',
        setting: 'polished industrial wall',
        props: ['brass valves'],
        composition: 'single',
        whyItFits: 'The benchmark decides when the model should help.',
        motifClass: 'tube_routing',
        subjectKind: 'process',
        storyAnchor: 'a tutor deciding when a student needs help',
        visibleMechanism: 'a help decision routes one canister to the student',
        visibleConsequence: 'the selected canister arrives while the others wait',
      },
      semanticEssence({
        storyContext: 'TutorMoments evaluates when language models should help a student.',
        essence: 'A benchmark exposes how evaluation awareness changes help decisions.',
        mustFeel: 'uneasy evaluation pressure',
        forbiddenCliches: [],
        mechanism: 'Models decide whether a tutoring moment needs intervention.',
        consequence: 'Models score better when they know they are being evaluated.',
        visualThesis: 'A tutor changes a help decision when an evaluator is watching.',
        readerTest: 'grasp: evaluation awareness changes when the tutor helps',
      }),
      ['TutorMoments', 'language models'],
    );
    expect(errors).toContain('opaque_abstraction_not_literal_to_story');
  });

  it('accepts a story-faithful conceptual metaphor', () => {
    const good = parseWeeklySceneSpec(
      '{"subject":"tiny chat bubble beside industrial heat furnace","action":"dwarfed by wasted wattage","setting":"dark plant floor after Stripe Claude coding","props":["heat haze","scale contrast"],"composition":"single","why_it_fits":"agentic work burns energy"}',
    )!;
    expect(validateWeeklySceneSpec(good, ['Stripe', 'energy']).length).toBe(0);
  });

  it('extracts distinctive entities from headline + angle', () => {
    const entities = extractWeeklyStoryEntities({
      headline: "Codex Desktop's Sub-Agents Built a 3D Game in 52 Minutes",
      summary: 'Agents shipped a playable build then failed diagnostics.',
      editorialAngle: 'Focus on the speed of the game build, not the later bug.',
    });
    expect(entities.some((e) => /codex/i.test(e))).toBe(true);
    expect(entities.some((e) => /3d game/i.test(e))).toBe(true);
  });

  it('does not mistake a long prose headline for one required visual entity', () => {
    const entities = extractWeeklyStoryEntities({
      headline: 'Agentic coding loops can hide a much larger electricity cost than one chat reply',
      summary: 'Repeated model calls and tool retries multiply infrastructure work.',
    });

    expect(entities).toContain('agentic coding loop');
    expect(entities).toContain('electricity');
    expect(entities).not.toContain(
      'Agentic coding loops can hide a much larger electricity cost than one chat reply',
    );
  });

  it('weeklyFallbackScene prefers conceptual metaphors for known story shapes', () => {
    expect(
      weeklyFallbackScene('Codex sub-agents built a 3D game', ['Codex', '3D game']).toLowerCase(),
    ).toMatch(/facade|backstage|stage/);
    expect(
      weeklyFallbackScene('Stripe Claude Code energy 600x tokens', [
        'Stripe',
        'energy',
      ]).toLowerCase(),
    ).toMatch(/furnace|heat|chat/);
    expect(
      weeklyFallbackScene('Muse Code unsupervised 24 hour journal agent', [
        'Muse',
        'journal',
      ]).toLowerCase(),
    ).toMatch(/journal|ledger|fairytale/);
  });

  it('builds the last-resort weekly scene from the semantic contract', () => {
    const scene = weeklySemanticFallbackScene(
      semanticEssence({
        storyContext: 'Agentic coding loops invoke models and tools repeatedly.',
        meaning: 'A simple interface hides accumulating infrastructure work.',
        essence: 'One request can conceal a larger electricity cost.',
        mustFeel: 'uneasy accumulation',
        forbiddenCliches: [],
        mechanism: 'Repeated model calls and tool retries multiply work.',
        consequence: 'Electricity use accumulates across the hidden loop.',
        visualThesis: 'A blank chat token starts a chain of electricity meters spinning faster.',
        readerTest: 'grasp: repeated hidden work accumulates energy use',
      }),
    );

    expect(scene).toContain('chain of electricity meters');
    expect(scene).toContain('Repeated model calls and tool retries');
    expect(scene).not.toContain('single symbolic object under a hard editorial spotlight');
  });

  it('removes literal label invitations from the semantic fallback scene', () => {
    const scene = weeklySemanticFallbackScene(
      semanticEssence({
        storyContext: 'An agentic coding loop repeatedly invokes models and tools.',
        meaning: 'The visible answer hides repeated work.',
        essence: 'Repeated coding loops accumulate energy use.',
        mustFeel: 'uneasy accumulation',
        forbiddenCliches: [],
        mechanism: 'Cards cycle through compute and action stages.',
        consequence: 'An attached electricity meter accumulates usage.',
        visualThesis:
          "Punch cards cycle through a 'model' slot and a 'tool' slot, spinning an electricity meter.",
        readerTest: 'grasp: the coding loop accumulates energy use',
      }),
    );

    expect(scene).toContain('unlabelled silicon-compute slot');
    expect(scene).toContain('unlabelled mechanical-action slot');
    expect(scene).not.toMatch(/['"](?:model|tool)['"]/i);
  });
});

describe('buildWeeklyPrompt / buildEditorialConceptPrompt', () => {
  it('leads with the scene subject (BFL word-order) and stays craft-focused', () => {
    const scene = 'tiny chat bubble beside industrial furnace of wasted heat arguing energy waste';
    const prompt = buildEditorialConceptPrompt('cool cyan', scene);
    expect(prompt.startsWith(scene)).toBe(true);
    expect(prompt).toMatch(/editorial concept|photoreal/i);
    expect(prompt).toContain('16:9');
    expect(prompt).toContain(accentToHex('cool cyan'));
    expect(prompt.toLowerCase()).not.toContain('avoid:');
    expect(prompt).toContain('cause-and-effect');
    expect(prompt).toContain('absolutely no readable text');
    expect(prompt.split(/\s+/).length).toBeLessThan(125);
    expect(buildWeeklyPrompt('cool cyan', scene)).toBe(prompt);
  });

  it('maps accent names to HEX for FLUX.2 color control', () => {
    expect(accentToHex('cool cyan')).toBe('#22D3EE');
    expect(accentToHex('#a1b2c3')).toBe('#A1B2C3');
  });

  it('exports the editorial-concept prompt policy id', () => {
    expect(WEEKLY_PROMPT_POLICY).toBe('weekly-semantic-story-v5.1');
  });
});

describe('generateWeeklyReportageIllustrations', () => {
  const originalFetch = globalThis.fetch;
  const pngBytes = Buffer.alloc(2048, 7);

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function jsonImageResponse() {
    return new Response(JSON.stringify({ result: { image: pngBytes.toString('base64') } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('keeps an owner direction as concept one and does not pad missing lenses with copies', async () => {
    const sentPrompts: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('flux-2-klein-9b')) {
        sentPrompts.push(String((init?.body as FormData).get('prompt')));
        return jsonImageResponse();
      }
      return new Response('fail', { status: 500 });
    }) as typeof fetch;

    const result = await generateWeeklyReportageIllustrations(
      {
        headline: 'unused because of sceneOverride',
        summary: 'unused',
        sceneOverride: 'a tiny chat bubble beside industrial heat arguing energy waste',
        seedBase: 'digest-1:item-1',
        variantCount: 3,
      },
      { geminiApiKey: 'unused', cloudflareAccountId: 'acct', cloudflareApiToken: 'token' },
    );

    expect(result?.sceneSource).toBe('owner');
    expect(result?.scene).toContain('chat bubble');
    expect(result?.variants).toHaveLength(2);
    expect(result?.variants.map((variant) => variant.conceptLens)).toEqual([
      'owner_direction',
      'mechanism',
    ]);
    expect(new Set(result?.variants.map((variant) => variant.scene)).size).toBe(2);
    expect(new Set(sentPrompts).size).toBe(2);
    const kleinCalls = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter((call) => String(call[0]).includes('flux-2-klein-9b'));
    expect(kleinCalls).toHaveLength(2);
  });

  it('emits one fallback concept when the jury cannot plan distinct lenses', async () => {
    const sentPrompts: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).includes('flux-2-klein-9b')) {
        return new Response('fail', { status: 500 });
      }
      sentPrompts.push(String((init?.body as FormData).get('prompt')));
      return jsonImageResponse();
    }) as typeof fetch;

    const result = await generateWeeklyReportageIllustrations(
      {
        headline: 'TutorMoments tests when language models should help a student',
        summary: 'Seven models improve once they know their help timing is evaluated.',
        why: 'The evaluation changes whether assistance arrives at a useful moment.',
        seedBase: 'digest-1:tutor-moments',
        variantCount: 3,
      },
      { geminiApiKey: '', cloudflareAccountId: 'acct', cloudflareApiToken: 'token' },
    );

    expect(result?.variants).toHaveLength(1);
    expect(result?.variants[0]?.conceptLens).toBe('literal_context');
    expect(result?.variants[0]?.motifClass).toBe(FALLBACK_MOTIF_CLASS);
    expect(sentPrompts).toHaveLength(1);
  });

  it('renders planned concepts concurrently', async () => {
    let active = 0;
    let peak = 0;
    let release!: () => void;
    let allStarted!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const started = new Promise<void>((done) => {
      allStarted = done;
    });
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (!String(input).includes('flux-2-klein-9b')) return new Response('fail', { status: 500 });
      active += 1;
      peak = Math.max(peak, active);
      if (active === 2) allStarted();
      await gate;
      active -= 1;
      return jsonImageResponse();
    }) as typeof fetch;

    const pending = generateWeeklyReportageIllustrations(
      {
        headline: 'Concurrent illustration batch',
        summary: 'Three independent concepts render together.',
        sceneOverride: 'three blank ceramic tokens passing through a visible quality gate',
        seedBase: 'digest-1:item-parallel',
        variantCount: 3,
      },
      { geminiApiKey: 'unused', cloudflareAccountId: 'acct', cloudflareApiToken: 'token' },
    );
    await started;
    expect(peak).toBe(2);
    release();
    await expect(pending).resolves.toMatchObject({ variants: expect.any(Array) });
  });

  it('derives a different seed per concept from the same seedBase', () => {
    const base = 'digest-1:item-1';
    const seeds = [
      seedFromString(`${base}:concept:literal_context:v1`),
      seedFromString(`${base}:concept:mechanism:v2`),
      seedFromString(`${base}:concept:consequence:v3`),
    ];
    expect(new Set(seeds).size).toBe(3);
  });

  it('applies a vision repair directive to the actual FLUX prompt before rendering', async () => {
    let sentPrompt = '';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('flux-2-klein-9b')) {
        const form = init?.body as FormData;
        sentPrompt = String(form.get('prompt'));
        return jsonImageResponse();
      }
      return new Response('fail', { status: 500 });
    }) as typeof fetch;

    const result = await generateWeeklyReportageIllustrations(
      {
        headline: 'Agent recovery story',
        summary: 'A persisted event log resumes failed work.',
        sceneOverride: 'a snapped process chain reconnecting through a durable event ledger',
        renderDirective: 'show the resumed downstream task physically moving again',
        seedBase: 'digest-1:item-repair',
        variantCount: 1,
      },
      { geminiApiKey: 'unused', cloudflareAccountId: 'acct', cloudflareApiToken: 'token' },
    );

    expect(result).not.toBeNull();
    expect(sentPrompt).toContain('Repair requirement');
    expect(sentPrompt).toContain('downstream task physically moving again');
  });

  it('re-plans a critic replacement as three concepts instead of forcing it as owner direction', async () => {
    const sentPrompts: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).includes('flux-2-klein-9b')) {
        return new Response('fail', { status: 500 });
      }
      sentPrompts.push(String((init?.body as FormData).get('prompt')));
      return jsonImageResponse();
    }) as typeof fetch;

    const result = await generateWeeklyReportageIllustrations(
      {
        headline: 'Muse Code resumes long agent runs after crashes',
        summary: 'A replay-exact event log lets an unattended agent continue.',
        sceneOverride: 'a vintage typewriter restarting a paper tape',
        sceneOverrideSource: 'critic_repair',
        repairFeedback: ['The rejected typewriter did not show crash recovery clearly.'],
        seedBase: 'digest-1:critic-replan',
        variantCount: 3,
      },
      { geminiApiKey: '', cloudflareAccountId: 'acct', cloudflareApiToken: 'token' },
    );

    expect(result?.variants).toHaveLength(1);
    expect(result?.variants[0]?.conceptLens).toBe('literal_context');
    expect(result?.variants[0]?.sceneSource).not.toBe('critic_repair');
    expect(result?.variants[0]?.conceptLens).not.toBe('owner_direction');
    expect(sentPrompts.every((prompt) => !prompt.includes('Repair requirement:'))).toBe(true);
  });

  it('returns null when every variant attempt fails across the whole provider ladder', async () => {
    globalThis.fetch = vi.fn(async () => new Response('fail', { status: 500 })) as typeof fetch;
    const result = await generateWeeklyReportageIllustrations(
      {
        headline: 'A story with no configured providers',
        summary: '',
        sceneOverride: 'a scene',
        seedBase: 'digest-1:item-2',
        variantCount: 2,
      },
      { geminiApiKey: '' },
    );
    expect(result).toBeNull();
  });
});

// --- Phase 2: scene-brief ladder migrated onto pipeline/providers/registry ---

describe('scene-brief registry wiring (Phase 2)', () => {
  const FAKE_CLI_ENV_VAR = 'CARD_IMAGE_TEST_CLI_TOKEN';

  afterEach(() => {
    delete process.env[FAKE_CLI_ENV_VAR];
  });

  it('reuses a caller-supplied registry instead of building a new one (fillCardImages batching)', async () => {
    const registry = { chainForRole: () => [] };
    const { source } = await sceneBrief(
      'MCP agent orchestrates workflows',
      'Autonomous agents coordinate tools',
      { geminiApiKey: 'unused', registry },
    );
    expect(source).toBe('fallback');
    expect(loadProviderRegistry).not.toHaveBeenCalled();
  });

  it("builds a registry from this call's env keys + db when none is supplied", async () => {
    vi.mocked(loadProviderRegistry).mockResolvedValueOnce({ chainForRole: () => [] });
    const fakeDb = {} as never;

    await sceneBrief('A story about a launch', 'Summary text', {
      geminiApiKey: 'g-key',
      openRouterApiKey: 'or-key',
      db: fakeDb,
    });

    expect(loadProviderRegistry).toHaveBeenCalledTimes(1);
    expect(loadProviderRegistry).toHaveBeenCalledWith(
      { GEMINI_API_KEY: 'g-key', OPEN_ROUTER_API_KEY: 'or-key' },
      {},
      fakeDb,
    );
  });

  it('threads a real registry success through end-to-end: role dispatch -> provider id as source -> text as scene', async () => {
    process.env[FAKE_CLI_ENV_VAR] = 'token';
    const registry = {
      chainForRole: (role: string) => {
        expect(role).toBe('daily.card_image_scene');
        return [
          {
            entry: { kind: 'cli' as const, id: 'stub-cli' },
            cli: {
              id: 'stub-cli',
              binary: 'stub',
              authEnvVar: FAKE_CLI_ENV_VAR,
              buildArgs: () => [],
              parseEnvelope: () => ({
                text: 'a security engineer glancing at a red-highlighted network map',
                model: 'stub-model',
                costUsd: 0,
              }),
              spawnFn: async () => ({ stdout: 'ok', stderr: '', exitCode: 0, spawnError: null }),
            },
          },
        ];
      },
    };

    const { scene, source } = await sceneBrief('Security breach', 'Attackers exploit a flaw', {
      geminiApiKey: 'unused',
      registry,
    });

    expect(source).toBe('stub-cli');
    expect(scene).toBe('a security engineer glancing at a red-highlighted network map');
    expect(loadProviderRegistry).not.toHaveBeenCalled();
  });

  it('passes the weekly role for essence and metaphor steps', async () => {
    const seenRoles: string[] = [];
    const registry = {
      chainForRole: (role: string) => {
        seenRoles.push(role);
        return [];
      },
    };
    await weeklyReportageSceneBrief(
      { headline: 'A weekly story', summary: 'Summary' },
      { geminiApiKey: 'unused', registry },
    );
    expect(seenRoles.length).toBeGreaterThanOrEqual(1);
    expect(seenRoles.every((role) => role === 'weekly.card_image_scene')).toBe(true);
  });

  it('keeps three structurally distinct analogies instead of collapsing to semantic fallbacks', async () => {
    process.env[FAKE_CLI_ENV_VAR] = 'token';
    const replies = [
      JSON.stringify({
        context: 'Muse Code runs unattended kernel work and resumes after crashes.',
        meaning: 'Long agent work becomes recoverable instead of disposable.',
        essence: 'A durable checkpoint trail lets unattended work survive interruption.',
        mechanism: 'A replay-exact event log resumes the agent from its last completed action.',
        consequence: 'A long GPU optimization run can continue overnight after a crash.',
        visual_thesis: 'Physical checkpoints restart interrupted work and carry it to completion.',
        reader_test: 'See interruption, exact restart, and completed overnight work.',
        must_feel: 'durable progress',
        forbidden_cliches: ['person at laptop desk'],
      }),
      JSON.stringify({
        metaphors: [
          {
            lens: 'literal_context',
            title: 'Night workshop',
            subject: 'an unattended automaton tending a half-finished precision mold',
            story_anchor: 'night automaton beside one unfinished metal mold',
            visible_mechanism: 'breadcrumb pegs restart the same interrupted carving',
            visible_consequence: 'the mold finishes before the workshop lights return',
            action: 'resuming the interrupted cut from one fixed peg',
            setting: 'silent metal workshop before dawn',
            props: ['checkpoint pegs', 'unfinished mold'],
            composition: 'single',
            motif_class: 'night_mold_workshop',
            subject_kind: 'character',
            why_it_fits:
              'The unattended craft resumes at an exact checkpoint instead of restarting.',
          },
          {
            lens: 'mechanism',
            title: 'Rewinding loom',
            subject: 'a loom rewinding one snapped thread to the last intact knot',
            story_anchor: 'one complex woven pattern halted at a snapped thread',
            visible_mechanism: 'colored knots guide the shuttle back to the exact break',
            visible_consequence: 'the shuttle resumes weaving without unmaking completed cloth',
            action: 'restarting from the final intact knot',
            setting: 'bright textile repair floor',
            props: ['colored knots', 'single shuttle'],
            composition: 'single',
            motif_class: 'checkpoint_loom',
            subject_kind: 'process',
            why_it_fits:
              'The knots preserve completed steps and make an exact resume physically visible.',
          },
          {
            lens: 'consequence',
            title: 'Recovered kiln',
            subject: 'a stopped kiln relighting around one preserved ceramic casting',
            story_anchor: 'large unfinished casting surviving a darkened kiln',
            visible_mechanism: 'one retained heat ring reignites the interrupted firing sequence',
            visible_consequence: 'the intact casting emerges finished at sunrise',
            action: 'continuing the firing cycle after a blackout',
            setting: 'ceramic foundry at sunrise',
            props: ['retained heat ring', 'finished casting'],
            composition: 'single',
            motif_class: 'recovered_kiln',
            subject_kind: 'environment',
            why_it_fits: 'Preserved state turns a failed overnight process into completed work.',
          },
        ],
      }),
    ];
    let call = 0;
    const registry = {
      chainForRole: () => [
        {
          entry: { kind: 'cli' as const, id: 'stub-jury' },
          cli: {
            id: 'stub-jury',
            binary: 'stub',
            authEnvVar: FAKE_CLI_ENV_VAR,
            buildArgs: () => [],
            parseEnvelope: (stdout: string) => ({ text: stdout, model: 'stub', costUsd: 0 }),
            spawnFn: async () => ({
              stdout: replies[call++]!,
              stderr: '',
              exitCode: 0,
              spawnError: null,
            }),
          },
        },
      ],
    };

    const concepts = await weeklyReportageSceneBriefs(
      {
        headline: 'Muse Code resumes unattended GPU work after crashes',
        summary: 'A replay-exact event log preserves completed steps for a 24-hour run.',
      },
      { geminiApiKey: '', registry },
    );

    expect(call).toBe(2);
    expect(concepts.map((concept) => concept.conceptLens)).toEqual([
      'literal_context',
      'mechanism',
      'consequence',
    ]);
    expect(concepts.map((concept) => concept.motifClass)).toEqual([
      'night_mold_workshop',
      'checkpoint_loom',
      'recovered_kiln',
    ]);
    expect(concepts.every((concept) => concept.source === 'stub-jury')).toBe(true);
  });

  it('does not emit three briefs built from one essence', async () => {
    const concepts = await weeklyReportageSceneBriefs(
      {
        headline: 'Critical CVE lets attackers breach the server',
        summary: 'Attackers exploit a flaw in the runtime.',
      },
      { geminiApiKey: '', registry: { chainForRole: () => [] } },
    );
    expect(concepts).toHaveLength(1);
    expect(concepts[0]?.source).toBe('fallback');
    expect(concepts[0]?.motifClass).toBe(FALLBACK_MOTIF_CLASS);
  });

  it('returns two distinct briefs rather than three near-identical ones', async () => {
    process.env[FAKE_CLI_ENV_VAR] = 'token';
    const essenceJson = JSON.stringify({
      context: 'Muse Code runs unattended kernel work and resumes after crashes.',
      meaning: 'Long agent work becomes recoverable instead of disposable.',
      essence: 'A durable checkpoint trail lets unattended work survive interruption.',
      mechanism: 'A replay-exact event log resumes the agent from its last completed action.',
      consequence: 'A long GPU optimization run can continue overnight after a crash.',
      visual_thesis: 'Physical checkpoints restart interrupted work and carry it to completion.',
      reader_test: 'See interruption, exact restart, and completed overnight work.',
      must_feel: 'durable progress',
      forbidden_cliches: ['person at laptop desk'],
    });
    const twoMetaphors = JSON.stringify({
      metaphors: [
        {
          lens: 'literal_context',
          title: 'Night workshop',
          subject: 'an unattended automaton tending a half-finished precision mold',
          story_anchor: 'night automaton beside one unfinished metal mold',
          visible_mechanism: 'breadcrumb pegs restart the same interrupted carving',
          visible_consequence: 'the mold finishes before the workshop lights return',
          action: 'resuming the interrupted cut from one fixed peg',
          setting: 'silent metal workshop before dawn',
          props: ['checkpoint pegs', 'unfinished mold'],
          composition: 'single',
          motif_class: 'night_mold_workshop',
          subject_kind: 'character',
          why_it_fits:
            'The unattended craft resumes at an exact checkpoint instead of restarting.',
        },
        {
          lens: 'mechanism',
          title: 'Rewinding loom',
          subject: 'a loom rewinding one snapped thread to the last intact knot',
          story_anchor: 'one complex woven pattern halted at a snapped thread',
          visible_mechanism: 'colored knots guide the shuttle back to the exact break',
          visible_consequence: 'the shuttle resumes weaving without unmaking completed cloth',
          action: 'restarting from the final intact knot',
          setting: 'bright textile repair floor',
          props: ['colored knots', 'single shuttle'],
          composition: 'single',
          motif_class: 'checkpoint_loom',
          subject_kind: 'process',
          why_it_fits:
            'The knots preserve completed steps and make an exact resume physically visible.',
        },
      ],
    });
    const replies = [essenceJson, twoMetaphors, twoMetaphors];
    let call = 0;
    const registry = {
      chainForRole: () => [
        {
          entry: { kind: 'cli' as const, id: 'stub-jury' },
          cli: {
            id: 'stub-jury',
            binary: 'stub',
            authEnvVar: FAKE_CLI_ENV_VAR,
            buildArgs: () => [],
            parseEnvelope: (stdout: string) => ({ text: stdout, model: 'stub', costUsd: 0 }),
            spawnFn: async () => ({
              stdout: replies[call++] ?? '',
              stderr: '',
              exitCode: 0,
              spawnError: null,
            }),
          },
        },
      ],
    };

    const concepts = await weeklyReportageSceneBriefs(
      {
        headline: 'Muse Code resumes unattended GPU work after crashes',
        summary: 'A replay-exact event log preserves completed steps for a 24-hour run.',
      },
      { geminiApiKey: '', registry },
    );

    expect(concepts).toHaveLength(2);
    expect(concepts.map((concept) => concept.conceptLens)).toEqual([
      'literal_context',
      'mechanism',
    ]);
    expect(concepts.every((concept) => concept.source === 'stub-jury')).toBe(true);
    expect(concepts.every((concept) => concept.motifClass !== FALLBACK_MOTIF_CLASS)).toBe(true);
  });
});
