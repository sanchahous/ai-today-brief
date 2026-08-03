import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  buildPrompt,
  DEFAULT_CF_IMAGE_MODEL,
  estimateCloudflareImageCostUsd,
  fallbackIllustrationMotif,
  fallbackScene,
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
} from './card-image';

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

  it('detects multipart FLUX.2 model ids', () => {
    expect(isFlux2MultipartModel('@cf/black-forest-labs/flux-2-klein-9b')).toBe(true);
    expect(isFlux2MultipartModel('@cf/black-forest-labs/flux-2-dev')).toBe(true);
    expect(isFlux2MultipartModel(SCHNELL_MODEL)).toBe(false);
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
    expect(prompt).toContain('No text');
    expect(prompt).toContain('16:9');
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
    const scene = await sceneBrief('', '', { geminiApiKey: 'unused' });
    expect(scene).toContain('workstation');
  });
});
