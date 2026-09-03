import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isProductionBuild,
  publicContentMemoKey,
  resetBuildMemoForTests,
  withBuildMemo,
} from '@/lib/public-content-build-memo';

describe('isProductionBuild', () => {
  afterEach(() => {
    delete process.env.NEXT_PHASE;
  });

  it('is off outside next build', () => {
    delete process.env.NEXT_PHASE;
    expect(isProductionBuild()).toBe(false);
  });

  it('is on during phase-production-build', () => {
    process.env.NEXT_PHASE = 'phase-production-build';
    expect(isProductionBuild()).toBe(true);
  });
});

describe('withBuildMemo', () => {
  let dir: string | undefined;

  afterEach(() => {
    resetBuildMemoForTests();
    delete process.env.NEXT_PHASE;
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('does not memoize when disabled', async () => {
    const load = vi.fn(async () => 1);
    expect(await withBuildMemo('k', [], load, { enabled: false })).toBe(1);
    expect(await withBuildMemo('k', [], load, { enabled: false })).toBe(1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('stays off when NEXT_PHASE is unset', async () => {
    delete process.env.NEXT_PHASE;
    const load = vi.fn(async () => 1);
    expect(await withBuildMemo('k', [], load)).toBe(1);
    expect(await withBuildMemo('k', [], load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('calls the loader once for identical keys in one process', async () => {
    dir = mkdtempSync(join(tmpdir(), 'atb-memo-'));
    const load = vi.fn(async () => ({ slug: 'models' }));
    const first = await withBuildMemo('categories', ['en'], load, { enabled: true, dir });
    const second = await withBuildMemo('categories', ['en'], load, { enabled: true, dir });
    expect(first).toEqual({ slug: 'models' });
    expect(second).toEqual({ slug: 'models' });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('dedupes in-flight loads', async () => {
    dir = mkdtempSync(join(tmpdir(), 'atb-memo-'));
    let release: (value: number) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          release = resolve;
        }),
    );
    const a = withBuildMemo('n', [1], load, { enabled: true, dir });
    const b = withBuildMemo('n', [1], load, { enabled: true, dir });
    release(7);
    expect(await Promise.all([a, b])).toEqual([7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reuses the disk file after the in-memory map is cleared', async () => {
    dir = mkdtempSync(join(tmpdir(), 'atb-memo-'));
    const first = vi.fn(async () => ({ n: 3 }));
    await withBuildMemo('home-data', ['uk'], first, { enabled: true, dir });
    resetBuildMemoForTests();
    const second = vi.fn(async () => ({ n: 99 }));
    const value = await withBuildMemo('home-data', ['uk'], second, { enabled: true, dir });
    expect(value).toEqual({ n: 3 });
    expect(second).not.toHaveBeenCalled();
  });

  it('does not keep a failed load, so the next call retries', async () => {
    dir = mkdtempSync(join(tmpdir(), 'atb-memo-'));
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('postgrest down'))
      .mockResolvedValueOnce('ok');
    await expect(withBuildMemo('x', [], load, { enabled: true, dir })).rejects.toThrow(
      'postgrest down',
    );
    expect(await withBuildMemo('x', [], load, { enabled: true, dir })).toBe('ok');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('treats different args as different entries', async () => {
    dir = mkdtempSync(join(tmpdir(), 'atb-memo-'));
    const load = vi.fn(async (lang: string) => lang.toUpperCase());
    const en = await withBuildMemo('categories', ['en'], () => load('en'), {
      enabled: true,
      dir,
    });
    const uk = await withBuildMemo('categories', ['uk'], () => load('uk'), {
      enabled: true,
      dir,
    });
    expect(en).toBe('EN');
    expect(uk).toBe('UK');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('refetches when the disk file is not valid JSON', async () => {
    dir = mkdtempSync(join(tmpdir(), 'atb-memo-'));
    const id = publicContentMemoKey('home-data', ['en']);
    writeFileSync(join(dir, `${id}.json`), '{not-json');
    const load = vi.fn(async () => ({ n: 4 }));
    expect(await withBuildMemo('home-data', ['en'], load, { enabled: true, dir })).toEqual({
      n: 4,
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('skips the disk write for circular values and still returns them', async () => {
    dir = mkdtempSync(join(tmpdir(), 'atb-memo-'));
    type Box = { n: number; self?: Box };
    const value: Box = { n: 1 };
    value.self = value;
    const first = vi.fn(async () => value);
    expect(await withBuildMemo('circ', [], first, { enabled: true, dir })).toBe(value);
    resetBuildMemoForTests();
    const second = vi.fn(async () => ({ n: 99 }));
    expect(await withBuildMemo('circ', [], second, { enabled: true, dir })).toEqual({ n: 99 });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not persist undefined loader results', async () => {
    dir = mkdtempSync(join(tmpdir(), 'atb-memo-'));
    const first = vi.fn(async () => undefined);
    expect(await withBuildMemo('undef', [], first, { enabled: true, dir })).toBeUndefined();
    resetBuildMemoForTests();
    const second = vi.fn(async () => 'later');
    expect(await withBuildMemo('undef', [], second, { enabled: true, dir })).toBe('later');
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('publicContentMemoKey', () => {
  it('is stable for the same key and args', () => {
    expect(publicContentMemoKey('categories', ['en'])).toBe(
      publicContentMemoKey('categories', ['en']),
    );
    expect(publicContentMemoKey('categories', ['en'])).not.toBe(
      publicContentMemoKey('categories', ['uk']),
    );
  });
});
