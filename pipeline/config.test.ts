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
    expect(cfg.perTopicCap).toBe(2);
    expect(cfg.minScore).toBeCloseTo(0.15);
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

  it('detects --dry-run from argv and DRY_RUN from env', () => {
    expect(loadPipelineConfig(base, ['node', 'x', '--dry-run']).dryRun).toBe(true);
    expect(loadPipelineConfig({ ...base, DRY_RUN: '1' }, []).dryRun).toBe(true);
  });
});
