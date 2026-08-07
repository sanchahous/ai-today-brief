import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { loadProviderRegistry } from './providers/registry';
import {
  buildPrompt,
  buildWeeklyPrompt,
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

// --- Weekly Digest "reportage" illustrations (editorial quality overhaul, PR5) ---

describe('weeklyReportageSceneBrief', () => {
  it('returns the default scene without any network call when there is no context', async () => {
    const { scene, source } = await weeklyReportageSceneBrief(
      { headline: '', summary: '' },
      { geminiApiKey: 'unused' },
    );
    expect(scene).toContain('workstation');
    expect(source).toBe('fallback');
  });

  it('falls back to the same keyword scene as the daily path when every provider is unconfigured', async () => {
    const { scene, source } = await weeklyReportageSceneBrief(
      { headline: 'Critical CVE lets attackers breach the server', summary: '' },
      { geminiApiKey: '' },
    );
    expect(source).toBe('fallback');
    expect(scene).toContain('padlock');
  });
});

describe('buildWeeklyPrompt', () => {
  it('describes a documentary/reportage register, distinct from the daily illustration style', () => {
    const prompt = buildWeeklyPrompt('cyan', 'a security engineer glancing at a red-highlighted network map');
    expect(prompt).toContain('cyan');
    expect(prompt).toContain('a security engineer glancing at a red-highlighted network map');
    expect(prompt).toMatch(/documentary|reportage/i);
    expect(prompt).toContain('16:9');
    // Never the daily path's "illustration/metaphor" framing.
    expect(prompt.toLowerCase()).not.toContain('narrative metaphor');
  });

  it('folds the full avoid-list into the positive prompt (the klein-multipart negative_prompt fix)', () => {
    // FLUX.2 klein's multipart Workers AI call never transmits a separate
    // negative_prompt (runCloudflareMultipart only sends prompt/width/
    // height) -- so on the default weekly provider, a bare negativePrompt()
    // is silently never sent. This is the actual fix: the avoid-list must
    // live inside the positive prompt string itself.
    const prompt = buildWeeklyPrompt('cyan', 'a scene');
    expect(prompt).toContain('glowing brain');
    expect(prompt).toContain('cracked padlock');
    expect(prompt).toContain('robotic arms shaking hands');
    expect(prompt).toContain('anonymous server aisle');
    expect(prompt.toLowerCase()).toContain('avoid:');
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
    const seenSeeds: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('flux-2-klein-9b')) {
        const body = init?.body;
        if (body instanceof FormData) seenSeeds.push(String(body.get('prompt')).length.toString());
        return jsonImageResponse();
      }
      return new Response('fail', { status: 500 });
    }) as typeof fetch;

    const result = await generateWeeklyReportageIllustrations(
      {
        headline: 'unused because of sceneOverride',
        summary: 'unused',
        sceneOverride: 'a hand closing a laptop lid in a dim office at night',
        seedBase: 'digest-1:item-1',
        variantCount: 3,
      },
      { geminiApiKey: 'unused', cloudflareAccountId: 'acct', cloudflareApiToken: 'token' },
    );

    expect(result?.sceneSource).toBe('owner');
    expect(result?.scene).toBe('a hand closing a laptop lid in a dim office at night');
    expect(result?.variants).toHaveLength(3);
    // No Gemini/OpenRouter scene call was made -- only 3 klein calls.
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

  it('passes the weekly role to a supplied registry', async () => {
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
    expect(seenRoles).toEqual(['weekly.card_image_scene']);
  });
});
