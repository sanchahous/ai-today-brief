import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateDailyVisualImage,
  parseDailyVisualImageRoute,
  resolveDailyVisualImageRoute,
  type DailyVisualImageModelRoute,
} from './daily-visual-openrouter';

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const PRIMARY: DailyVisualImageModelRoute = {
  model: 'bytedance-seed/seedream-5-0-pro',
  provider: 'seed',
  resolution: '1K',
  aspectRatio: '16:9',
  fixedCostMicroUsd: 45_000,
  catalogCreatedAt: 100,
};

afterEach(() => vi.restoreAllMocks());

describe('generateDailyVisualImage', () => {
  it('pins one fixed-price 16:9 OpenRouter endpoint and records returned cost', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        data: [
          {
            b64_json: Buffer.from('visual-bytes').toString('base64'),
            media_type: 'image/png',
          },
        ],
        usage: { cost: 0.045 },
      }),
    );
    const image = await generateDailyVisualImage(
      'one clear causal scene',
      PRIMARY,
      { OPEN_ROUTER_API_KEY: 'test-key' },
      fetchImpl,
    );

    expect(image.bytes.toString()).toBe('visual-bytes');
    expect(image).toMatchObject({
      provider: 'openrouter',
      model: PRIMARY.model,
      usage: { costUsd: 0.045, costSource: 'reported' },
    });
    const [, request] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: PRIMARY.model,
      n: 1,
      resolution: '1K',
      aspect_ratio: '16:9',
      provider: {
        only: ['seed'],
        allow_fallbacks: false,
        require_parameters: true,
        max_price: { image: 0.045 },
      },
    });
  });

  it('does not pretend a missing OpenRouter key can be billed', async () => {
    await expect(generateDailyVisualImage('scene', PRIMARY, {})).rejects.toMatchObject({
      name: 'DailyVisualImageError',
      mayHaveBeenBilled: false,
    });
  });

  it('holds a reservation for ambiguous provider failures but releases a clear validation failure', async () => {
    await expect(
      generateDailyVisualImage(
        'scene',
        PRIMARY,
        { OPEN_ROUTER_API_KEY: 'key' },
        vi.fn().mockResolvedValue(response({ error: { message: 'busy' } }, 503)),
      ),
    ).rejects.toMatchObject({ mayHaveBeenBilled: true });
    await expect(
      generateDailyVisualImage(
        'scene',
        PRIMARY,
        { OPEN_ROUTER_API_KEY: 'key' },
        vi.fn().mockResolvedValue(response({ error: { message: 'bad prompt' } }, 400)),
      ),
    ).rejects.toMatchObject({ mayHaveBeenBilled: false });
  });

  it('treats a malformed successful response as potentially billed', async () => {
    await expect(
      generateDailyVisualImage(
        'scene',
        PRIMARY,
        { OPEN_ROUTER_API_KEY: 'key' },
        vi.fn().mockResolvedValue(response({ data: [] })),
      ),
    ).rejects.toMatchObject({ mayHaveBeenBilled: true });
  });
});

function model(
  id: string,
  created: number,
  resolutions: string[] = ['1K'],
): Record<string, unknown> {
  return {
    id,
    created,
    architecture: { input_modalities: ['text'], output_modalities: ['image'] },
    supported_parameters: {
      resolution: { type: 'enum', values: resolutions },
      aspect_ratio: { type: 'enum', values: ['16:9'] },
      n: { type: 'range', min: 1, max: 1 },
    },
  };
}

function endpoint(
  providerTag: string,
  costUsd: number,
  resolution: string,
  // Live Seedream/Qwen records include this optional reference-image line.
  // The daily renderer sends no input references, so it is not part of its
  // all-in route cost; an input-text line below remains a hard rejection.
  extraPricing: Record<string, unknown>[] = [
    { billable: 'input_image', unit: 'image', cost_usd: 0.01 },
  ],
): Record<string, unknown> {
  return {
    endpoints: [
      {
        provider_tag: providerTag,
        supported_parameters: {
          resolution: { type: 'enum', values: [resolution] },
          aspect_ratio: { type: 'enum', values: ['16:9'] },
          n: { type: 'range', min: 1, max: 1 },
        },
        pricing: [
          {
            billable: 'output_image',
            unit: 'image',
            cost_usd: costUsd,
            variant: resolution.toLowerCase(),
          },
          ...extraPricing,
        ],
      },
    ],
  };
}

function catalogFetch(input: { seedream6CostUsd?: number } = {}): typeof fetch {
  const catalog = {
    data: [
      model('bytedance-seed/seedream-5-0-pro', 100),
      model('bytedance-seed/seedream-5-0-lite', 105, ['2K']),
      model('qwen/qwen-image-3-pro', 90),
      model('qwen/qwen-image-4-pro', 110),
      // Catalog names alone never promote this model: its endpoint exceeds
      // the frozen $0.05 per-render ceiling.
      model('bytedance-seed/seedream-6-0-pro', 120),
    ],
  };
  return vi.fn(async (url: string | URL | Request) => {
    const value = String(url);
    if (value.endsWith('/images/models')) return response(catalog);
    if (value.endsWith('/seedream-5-0-pro/endpoints'))
      return response(endpoint('seed', 0.045, '1K'));
    if (value.endsWith('/seedream-5-0-lite/endpoints'))
      return response(endpoint('seed', 0.035, '2K'));
    if (value.endsWith('/qwen-image-3-pro/endpoints'))
      return response(endpoint('alibaba', 0.04, '1K'));
    if (value.endsWith('/qwen-image-4-pro/endpoints'))
      return response(endpoint('alibaba', 0.04, '1K'));
    if (value.endsWith('/seedream-6-0-pro/endpoints'))
      return response(endpoint('seed', input.seedream6CostUsd ?? 0.09, '1K'));
    return response({ error: { message: 'unexpected catalog URL' } }, 404);
  });
}

describe('resolveDailyVisualImageRoute', () => {
  it('keeps the established champion until a newer eligible Qwen Pro release becomes a canary', async () => {
    const fetchImpl = catalogFetch();
    const initial = await resolveDailyVisualImageRoute({
      env: { OPEN_ROUTER_API_KEY: 'test-key' },
      fetchImpl,
    });
    expect(initial.primary.model).toBe('bytedance-seed/seedream-5-0-pro');

    const canary = await resolveDailyVisualImageRoute({
      currentChampion: PRIMARY,
      env: { OPEN_ROUTER_API_KEY: 'test-key' },
      fetchImpl: catalogFetch(),
    });
    expect(canary).toMatchObject({
      strategy: 'canary',
      primary: { model: 'qwen/qwen-image-4-pro', provider: 'alibaba' },
      repair: { model: PRIMARY.model, provider: PRIMARY.provider },
    });
  });

  it('allows a later Seedream Pro generation to challenge the champion, but not a Lite SKU', async () => {
    const route = await resolveDailyVisualImageRoute({
      currentChampion: PRIMARY,
      env: { OPEN_ROUTER_API_KEY: 'test-key' },
      fetchImpl: catalogFetch({ seedream6CostUsd: 0.045 }),
    });
    expect(route).toMatchObject({
      strategy: 'canary',
      primary: { model: 'bytedance-seed/seedream-6-0-pro', provider: 'seed' },
      repair: { model: PRIMARY.model, provider: PRIMARY.provider },
    });
  });

  it('does not retry a previously failed canary and never accepts an arbitrary saved route', async () => {
    const route = await resolveDailyVisualImageRoute({
      currentChampion: PRIMARY,
      rejectedModelIds: new Set(['qwen/qwen-image-4-pro']),
      env: { OPEN_ROUTER_API_KEY: 'test-key' },
      fetchImpl: catalogFetch(),
    });
    expect(route).toMatchObject({ strategy: 'champion', primary: { model: PRIMARY.model } });
    expect(
      parseDailyVisualImageRoute({
        policyId: 'daily-openrouter-image-route-v1',
        strategy: 'champion',
        catalogHash: 'a'.repeat(64),
        primary: { ...PRIMARY, provider: 'not safe provider!' },
        repair: {
          model: 'qwen/qwen-image-3-pro',
          provider: 'alibaba',
          resolution: '1K',
          aspectRatio: '16:9',
          fixedCostMicroUsd: 40_000,
          catalogCreatedAt: 90,
        },
        winner: null,
      }),
    ).toBeNull();
  });

  it('fails closed instead of substituting an unverified route when the champion vanishes', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('/images/models')) {
        return response({ data: [model('qwen/qwen-image-4-pro', 110)] });
      }
      if (value.endsWith('/qwen-image-4-pro/endpoints')) {
        return response(endpoint('alibaba', 0.04, '1K'));
      }
      return response({ error: { message: 'unexpected catalog URL' } }, 404);
    });
    await expect(
      resolveDailyVisualImageRoute({
        currentChampion: PRIMARY,
        env: { OPEN_ROUTER_API_KEY: 'test-key' },
        fetchImpl,
      }),
    ).rejects.toThrow('current daily visual champion is not live-eligible');
  });

  it('rejects an endpoint with a non-image billable line instead of estimating its cost', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('/images/models')) {
        return response({
          data: [
            model('bytedance-seed/seedream-5-0-pro', 100),
            model('qwen/qwen-image-3-pro', 90),
            model('qwen/qwen-image-4-pro', 110),
          ],
        });
      }
      if (value.endsWith('/seedream-5-0-pro/endpoints')) {
        return response(endpoint('seed', 0.045, '1K'));
      }
      if (value.endsWith('/qwen-image-3-pro/endpoints')) {
        return response(endpoint('alibaba', 0.04, '1K'));
      }
      if (value.endsWith('/qwen-image-4-pro/endpoints')) {
        return response(
          endpoint('alibaba', 0.04, '1K', [
            { billable: 'input_text', unit: 'token', cost_usd: 0.000001 },
          ]),
        );
      }
      return response({ error: { message: 'unexpected catalog URL' } }, 404);
    });
    const route = await resolveDailyVisualImageRoute({
      currentChampion: PRIMARY,
      env: { OPEN_ROUTER_API_KEY: 'test-key' },
      fetchImpl,
    });
    expect(route).toMatchObject({ strategy: 'champion', primary: { model: PRIMARY.model } });
  });

  it('prices the live Seedream shape from its base tier and skips a tier it cannot name', async () => {
    // Live OpenRouter records leave the cheapest declared tier variant-less and
    // state 2K only as `high_resolution`, which no resolution enum value
    // matches. Reading that bare line as the price of any tier would understate
    // a larger render, so a non-base tier must stay unpriced.
    const pricing = [
      { billable: 'output_image', unit: 'image', cost_usd: 0.045 },
      { billable: 'output_image', unit: 'image', cost_usd: 0.09, variant: 'high_resolution' },
      { billable: 'input_image', unit: 'image', cost_usd: 0.003 },
    ];
    const baseTierEndpoint = (providerTag: string, resolutions: string[]) => ({
      endpoints: [
        {
          provider_tag: providerTag,
          supported_parameters: {
            resolution: { type: 'enum', values: resolutions },
            aspect_ratio: { type: 'enum', values: ['16:9'] },
            n: { type: 'range', min: 1, max: 1 },
          },
          pricing,
        },
      ],
    });
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('/images/models')) {
        return response({
          data: [
            model('bytedance-seed/seedream-5-0-pro', 100, ['1K', '2K']),
            model('qwen/qwen-image-3-pro', 90),
            // Newer, but its cheapest declared tier is below the enum this
            // renderer accepts, so its 2K route has no provable fixed price.
            model('bytedance-seed/seedream-6-0-pro', 120, ['512', '2K']),
          ],
        });
      }
      if (value.endsWith('/seedream-5-0-pro/endpoints')) {
        return response(baseTierEndpoint('seed', ['1K', '2K']));
      }
      if (value.endsWith('/seedream-6-0-pro/endpoints')) {
        return response(baseTierEndpoint('seed', ['512', '2K']));
      }
      if (value.endsWith('/qwen-image-3-pro/endpoints')) {
        return response(endpoint('alibaba', 0.04, '1K'));
      }
      return response({ error: { message: 'unexpected catalog URL' } }, 404);
    });
    const route = await resolveDailyVisualImageRoute({
      currentChampion: PRIMARY,
      env: { OPEN_ROUTER_API_KEY: 'test-key' },
      fetchImpl,
    });
    expect(route).toMatchObject({
      strategy: 'champion',
      primary: { model: PRIMARY.model, resolution: '1K', fixedCostMicroUsd: 45_000 },
      repair: { model: 'qwen/qwen-image-3-pro' },
    });
  });

  it('keeps looking up a champion that has fallen outside the bounded newest-model window', async () => {
    const newerSeedreams = [9, 8, 7, 6].map((generation, index) =>
      model(`bytedance-seed/seedream-${generation}-0-pro`, 200 - index),
    );
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('/images/models')) {
        return response({
          data: [
            ...newerSeedreams,
            model('bytedance-seed/seedream-5-0-pro', 100),
            model('qwen/qwen-image-3-pro', 90),
          ],
        });
      }
      const seedream = /seedream-\d+-0-pro\/endpoints$/u.exec(value);
      if (seedream) return response(endpoint('seed', 0.045, '1K'));
      if (value.endsWith('/qwen-image-3-pro/endpoints')) {
        return response(endpoint('alibaba', 0.04, '1K'));
      }
      return response({ error: { message: 'unexpected catalog URL' } }, 404);
    });
    const route = await resolveDailyVisualImageRoute({
      currentChampion: PRIMARY,
      env: { OPEN_ROUTER_API_KEY: 'test-key' },
      fetchImpl,
    });
    expect(route).toMatchObject({
      strategy: 'canary',
      primary: { model: 'bytedance-seed/seedream-9-0-pro' },
      repair: { model: PRIMARY.model, provider: PRIMARY.provider },
    });
  });
});
