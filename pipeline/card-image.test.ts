import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { loadProviderRegistry } from './providers/registry';
import {
  buildPrompt,
  buildWeeklyPrompt,
  buildEditorialConceptPrompt,
  cleanSceneText,
  accentToHex,
  extractWeeklyStoryEntities,
  flattenMetaphorPitch,
  parseEditorialEssence,
  parseMetaphorPitches,
  parseWeeklySceneSpec,
  validateMetaphorPitch,
  validateWeeklySceneSpec,
  weeklyFallbackScene,
  mechanismTokensVisible,
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
    const kleinCall = vi.mocked(globalThis.fetch).mock.calls.find((call) =>
      String(call[0]).includes('flux-2-klein-9b'),
    );
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

describe('cleanSceneText', () => {
  it('unwraps art-director JSON wrappers so keys never reach the image prompt', () => {
    expect(
      cleanSceneText(
        '{"frame":"edge aisle with a technician sliding a server blade into a rack"}',
      ),
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
      '{"essence":"Shipping speed outran quality","mechanism":"rushed game build before QA","reader_test":"grasp: facade shipped first","must_feel":"uneasy contrast","forbidden_cliches":["glowing brain"]}',
    );
    expect(essence?.essence).toMatch(/speed outran quality/i);
    expect(essence?.mechanism).toMatch(/rushed game build/i);
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
          },
        ],
      }),
    );
    expect(pitches[0]?.composition).toBe('dual_contrast');
    expect(pitches[0]?.motifClass).toBe('theatrical_reveal');
    expect(pitches[0]?.subjectKind).toBe('character');
    expect(flattenMetaphorPitch(pitches[0]!).toLowerCase()).toContain('spatial divide');
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
      },
      {
        essence: 'Speed outran quality in a rushed 3D game build',
        mustFeel: 'uneasy',
        forbiddenCliches: [],
        mechanism: 'polished game facade shipped before quality caught up',
        readerTest: 'After seeing the image, grasp: facade shipped ahead of quality',
      },
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
    ];
    const essence = {
      essence: 'Unsupervised agents stay reliable via durable memory',
      mustFeel: 'vigilance',
      forbiddenCliches: [],
      mechanism: 'durable memory ledger that keeps the agent honest',
      readerTest: 'grasp: durable memory keeps unsupervised agents reliable',
    };
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
      {
        essence: 'Agentic coding burns vastly more energy than a chat prompt',
        mustFeel: 'waste',
        forbiddenCliches: [],
        mechanism: 'agentic coding loops that burn energy vs a tiny chat prompt',
        readerTest: 'grasp: agentic loops waste far more energy than chat',
      },
      ['energy'],
      siblings,
    );
    expect(dualCap).toContain('dual_contrast_digest_cap');
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
      {
        essence: 'Crash-proof agents need a durable event log',
        mustFeel: 'reliability under failure',
        forbiddenCliches: [],
        mechanism: 'crash-proof event log that resumes after failure',
        readerTest: 'After seeing the image, grasp: durable event log resumes after crash',
      },
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
      {
        essence: 'Agents build blind to their own bugs',
        mustFeel: 'uneasy speed',
        forbiddenCliches: [],
        mechanism: 'build process blind to its own bugs',
        readerTest: 'grasp: the build cannot see its own defects',
      },
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
      {
        essence: 'Agentic work burns energy invisibly',
        mustFeel: 'waste',
        forbiddenCliches: [],
        mechanism: 'invisible energy waste from agentic work',
        readerTest: 'grasp: agentic work burns energy invisibly',
      },
      ['Stripe', 'energy'],
    );
    expect(sludge.some((e) => /sludge|paper/i.test(e))).toBe(true);

    const bad = parseWeeklySceneSpec(
      '{"subject":"split-screen monitor","action":"showing terminal npx output","setting":"office desk","props":[],"must_include":[]}',
    )!;
    expect(validateWeeklySceneSpec(bad, ['Codex', '3D game']).length).toBeGreaterThan(0);
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

  it('weeklyFallbackScene prefers conceptual metaphors for known story shapes', () => {
    expect(
      weeklyFallbackScene('Codex sub-agents built a 3D game', ['Codex', '3D game']).toLowerCase(),
    ).toMatch(/facade|backstage|stage/);
    expect(
      weeklyFallbackScene('Stripe Claude Code energy 600x tokens', ['Stripe', 'energy']).toLowerCase(),
    ).toMatch(/furnace|heat|chat/);
    expect(
      weeklyFallbackScene('Muse Code unsupervised 24 hour journal agent', [
        'Muse',
        'journal',
      ]).toLowerCase(),
    ).toMatch(/journal|ledger|fairytale/);
  });
});

describe('buildWeeklyPrompt / buildEditorialConceptPrompt', () => {
  it('leads with the scene subject (BFL word-order) and stays craft-focused', () => {
    const scene =
      'tiny chat bubble beside industrial furnace of wasted heat arguing energy waste';
    const prompt = buildEditorialConceptPrompt('cool cyan', scene);
    expect(prompt.startsWith(scene)).toBe(true);
    expect(prompt).toMatch(/editorial concept|photoreal/i);
    expect(prompt).toContain('16:9');
    expect(prompt).toContain(accentToHex('cool cyan'));
    expect(prompt.toLowerCase()).not.toContain('avoid:');
    expect(prompt.split(/\s+/).length).toBeLessThan(90);
    expect(buildWeeklyPrompt('cool cyan', scene)).toBe(prompt);
  });

  it('maps accent names to HEX for FLUX.2 color control', () => {
    expect(accentToHex('cool cyan')).toBe('#22D3EE');
    expect(accentToHex('#a1b2c3')).toBe('#A1B2C3');
  });

  it('exports the editorial-concept prompt policy id', () => {
    expect(WEEKLY_PROMPT_POLICY).toBe('weekly-editorial-concept-v3');
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

  it('generates the requested number of variants, each from a distinct seed, using a scene override to skip the art-director call', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('flux-2-klein-9b')) {
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
    expect(result?.variants).toHaveLength(3);
    const kleinCalls = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter((call) => String(call[0]).includes('flux-2-klein-9b'));
    expect(kleinCalls).toHaveLength(3);
  });

  it('derives a different seed per variant from the same seedBase', () => {
    const base = 'digest-1:item-1';
    const seeds = [1, 2, 3].map((n) => seedFromString(`${base}:v${n}`));
    expect(new Set(seeds).size).toBe(3);
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

  it('builds a registry from this call\'s env keys + db when none is supplied', async () => {
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
});
