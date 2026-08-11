import { describe, expect, it } from 'vitest';
import { applyFixtureDirective } from './weekly-image-fixture';
import { runDailyBriefSim } from './daily-brief';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('applyFixtureDirective', () => {
  it('applies scene override and patches', () => {
    expect(applyFixtureDirective('base', { sceneOverride: 'new' })).toBe('new');
    expect(applyFixtureDirective('base', { promptPatches: ['a', 'b'] })).toBe('base a b');
  });
});

describe('runDailyBriefSim', () => {
  it('passes a clean fixture and flags review_comment markers', async () => {
    const dir = join(tmpdir(), `content-sim-daily-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const clean = join(dir, 'clean.json');
    writeFileSync(
      clean,
      JSON.stringify({
        capturedAt: new Date().toISOString(),
        briefId: 'b1',
        slug: 'test',
        items: [{ id: 'i1', title_en: 'Hello', review_status: 'pending' }],
      }),
    );
    const out1 = join(dir, 'out-clean');
    mkdirSync(out1, { recursive: true });
    const ok = await runDailyBriefSim(clean, out1);
    expect(ok.passed).toBe(true);

    const dirty = join(dir, 'dirty.json');
    writeFileSync(
      dirty,
      JSON.stringify({
        capturedAt: new Date().toISOString(),
        briefId: 'b2',
        items: [
          {
            id: 'i2',
            title_en: 'X',
            review_comment: 'джерело не підтверджує claim',
            review_status: 'pending',
          },
        ],
      }),
    );
    const out2 = join(dir, 'out-dirty');
    mkdirSync(out2, { recursive: true });
    const bad = await runDailyBriefSim(dirty, out2);
    expect(bad.passed).toBe(false);
    expect(bad.blockers.some((b) => b.code === 'unsupported_claim')).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
