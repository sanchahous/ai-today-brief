import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const inflight = new Map<string, Promise<unknown>>();

export function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

export function publicContentMemoKey(key: string, args: readonly unknown[]): string {
  const payload = JSON.stringify({ key, args });
  return createHash('sha256').update(payload).digest('hex');
}

export function resetBuildMemoForTests(): void {
  inflight.clear();
}

function defaultCacheDir(): string {
  return join(process.cwd(), '.next', 'cache', 'atb-public-content');
}

function readDisk(dir: string, id: string): unknown {
  try {
    return JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'));
  } catch {
    return undefined;
  }
}

function replaceFile(tmp: string, dest: string): void {
  try {
    renameSync(tmp, dest);
    return;
  } catch {
    // Windows cannot rename onto an existing file; drop dest and retry.
  }
  try {
    unlinkSync(dest);
  } catch {
    // dest may not exist yet on a racing worker
  }
  renameSync(tmp, dest);
}

function writeDisk(dir: string, id: string, value: unknown): void {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return;
  }
  let json: string | undefined;
  try {
    json = JSON.stringify(value);
  } catch {
    return;
  }
  if (typeof json !== 'string') return;
  const dest = join(dir, `${id}.json`);
  const tmp = join(dir, `${id}.${process.pid}.tmp`);
  try {
    writeFileSync(tmp, json);
    replaceFile(tmp, dest);
  } catch {
    try {
      unlinkSync(tmp);
    } catch {
      // tmp may already be gone
    }
  }
}

async function readOrLoad<T>(dir: string, id: string, load: () => Promise<T>): Promise<T> {
  const cached = readDisk(dir, id);
  // Disk JSON is untyped; the loader's Result is the contract for this key.
  if (cached !== undefined) return cached as T;
  const value = await load();
  writeDisk(dir, id, value);
  return value;
}

/**
 * During `next build`, identical public reads share one in-process Promise and a
 * JSON file under `.next/cache` so the 11 SSG workers do not each hit PostgREST
 * for `getCategories` / related / adjacent. Runtime ISR still uses Next Data Cache
 * + `revalidateTag` — this memo is build-only so publish invalidation stays honest.
 */
export async function withBuildMemo<T>(
  key: string,
  args: readonly unknown[],
  load: () => Promise<T>,
  options?: { enabled?: boolean; dir?: string },
): Promise<T> {
  const enabled = options?.enabled ?? isProductionBuild();
  if (!enabled) return load();

  const id = publicContentMemoKey(key, args);
  const pending = inflight.get(id);
  if (pending) return pending as Promise<T>; // Map stores Promise<unknown> across keys

  const dir = options?.dir ?? defaultCacheDir();
  const promise = readOrLoad(dir, id, load);
  inflight.set(id, promise);
  try {
    return await promise;
  } catch (error) {
    inflight.delete(id);
    throw error;
  }
}
