import { describe, expect, it } from 'vitest';
import { loadPipelineConfig } from './config';

const base: Record<string, string | undefined> = {
  SCRAPPER_BASE_URL: 'https://db.example.co',
  SCRAPPER_SERVICE_KEY: 'sb_secret_x',
  GEMINI_API_KEY: 'gem_x',
};

describe('loadPipelineConfig', () => {
  it('throws listing every missing required var', () => {
    expect(() => loadPipelineConfig({}, [])).toThrow(/GEMINI_API_KEY/);
    expect(() => loadPipelineConfig({}, [])).toThrow(/SCRAPPER_BASE_URL/);
  });

  it('resolves url + service key from fallback names', () => {
    const cfg = loadPipelineConfig(
      {
        NEXT_PUBLIC_SUPABASE_URL: 'https://app.example.co',
        SUPABASE_SERVICE_ROLE_KEY: 'role_x',
        GEMINI_API_KEY: 'gem_x',
      },
      [],
    );
    expect(cfg.supabaseUrl).toBe('https://app.example.co');
    expect(cfg.supabaseServiceKey).toBe('role_x');
  });

  it('applies tunable defaults', () => {
    const cfg = loadPipelineConfig(base, []);
    expect(cfg.maxItems).toBe(8);
    expect(cfg.poolSize).toBe(16);
    expect(cfg.perTopicCap).toBe(3);
    expect(cfg.minScore).toBeCloseTo(0.15);
    expect(cfg.embedLimit).toBe(20);
    expect(cfg.maxEmbedDistance).toBeCloseTo(0.12);
    expect(cfg.dryRun).toBe(false);
  });

  it('clamps out-of-range overrides back to defaults', () => {
    const cfg = loadPipelineConfig({ ...base, MAX_ITEMS: '99', MIN_SCORE: '5' }, []);
    expect(cfg.maxItems).toBe(8);
    expect(cfg.minScore).toBeCloseTo(0.15);
  });

  it('accepts valid overrides', () => {
    const cfg = loadPipelineConfig({ ...base, MAX_ITEMS: '5', POOL_SIZE: '20' }, []);
    expect(cfg.maxItems).toBe(5);
    expect(cfg.poolSize).toBe(20);
  });

  it('accepts embedLimit and maxEmbedDistance overrides and clamps out-of-range', () => {
    const cfg = loadPipelineConfig({ ...base, EMBED_LIMIT: '30', MAX_EMBED_DISTANCE: '0.3' }, []);
    expect(cfg.embedLimit).toBe(30);
    expect(cfg.maxEmbedDistance).toBeCloseTo(0.3);

    const clamped = loadPipelineConfig({ ...base, EMBED_LIMIT: '0', MAX_EMBED_DISTANCE: '2' }, []);
    expect(clamped.embedLimit).toBe(20);
    expect(clamped.maxEmbedDistance).toBeCloseTo(0.12);
  });

  it('detects --dry-run from argv and DRY_RUN from env', () => {
    expect(loadPipelineConfig(base, ['node', 'x', '--dry-run']).dryRun).toBe(true);
    expect(loadPipelineConfig({ ...base, DRY_RUN: '1' }, []).dryRun).toBe(true);
  });

  it('resolves openRouterApiKey from OPEN_ROUTER_API_KEY or OPENROUTER_API_KEY', () => {
    const withPrimary = loadPipelineConfig({ ...base, OPEN_ROUTER_API_KEY: 'sk-or-1' }, []);
    expect(withPrimary.openRouterApiKey).toBe('sk-or-1');

    const withFallback = loadPipelineConfig({ ...base, OPENROUTER_API_KEY: 'sk-or-2' }, []);
    expect(withFallback.openRouterApiKey).toBe('sk-or-2');

    // primary wins when both set
    const withBoth = loadPipelineConfig(
      { ...base, OPEN_ROUTER_API_KEY: 'sk-primary', OPENROUTER_API_KEY: 'sk-secondary' },
      [],
    );
    expect(withBoth.openRouterApiKey).toBe('sk-primary');

    const withNeither = loadPipelineConfig(base, []);
    expect(withNeither.openRouterApiKey).toBeUndefined();
  });
});
