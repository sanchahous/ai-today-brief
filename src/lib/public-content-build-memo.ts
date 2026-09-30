import { createHash } from 'node:crypto';
import {
  type Dirent,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const inflight = new Map<string, Promise<unknown>>();
const prunedBases = new Set<string>();

/**
 * A memo entry only has to outlive one `next build` (11 SSG workers, minutes).
 * Vercel restores `.next/cache` into the next build, so anything older than this
 * is a leftover from a previous deploy and must be reloaded from PostgREST.
 */
export const MEMO_MAX_AGE_MS = 30 * 60 * 1000;

/** Tolerated clock skew before a future timestamp is treated as corrupt. */
const MEMO_CLOCK_SKEW_MS = 60 * 1000;

interface MemoOptions {
  enabled?: boolean;
  dir?: string;
  /** Build identity; entries from another scope are never read. Default: Vercel deployment id. */
  scope?: string;
  maxAgeMs?: number;
  now?: () => number;
}

interface MemoEnvelope {
  /** Epoch ms at which `v` was loaded. */
  t: number;
  v: unknown;
}

export function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

export function publicContentMemoKey(key: string, args: readonly unknown[]): string {
  const payload = JSON.stringify({ key, args });
  return createHash('sha256').update(payload).digest('hex');
}

export function resetBuildMemoForTests(): void {
  inflight.clear();
  prunedBases.clear();
}

function defaultCacheDir(): string {
  return join(process.cwd(), '.next', 'cache', 'atb-public-content');
}

/** Identity of the current build, or '' when the platform does not provide one. */
function defaultScope(): string {
  return process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? '';
}

function scopeDir(base: string, scope: string): string {
  const safe = scope.replace(/[^A-Za-z0-9_-]/g, '_');
  return safe ? join(base, safe) : base;
}

/**
 * The cache dir survives between Vercel builds, so drop what earlier builds left:
 * sibling scope dirs and the flat `*.json` files written before entries were
 * scoped. Current-scope files are never touched, so concurrent workers are safe.
 */
function pruneStaleScopes(base: string, current: string): void {
  // Without a build scope entries live flat in `base`; only the TTL protects them.
  if (current === base || prunedBases.has(base)) return;
  prunedBases.add(base);
  let names: Dirent[];
  try {
    names = readdirSync(base, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of names) {
    const path = join(base, entry.name);
    if (path === current) continue;
    if (entry.isDirectory() || entry.name.endsWith('.json') || entry.name.endsWith('.tmp')) {
      try {
        rmSync(path, { recursive: true, force: true });
      } catch {
        // another worker removed it first, or it is locked; either way harmless
      }
    }
  }
}

function isEnvelope(value: unknown): value is MemoEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as MemoEnvelope).t === 'number' &&
    'v' in value
  );
}

/** Returns the stored value, or `undefined` when missing, unreadable, legacy or expired. */
function readDisk(dir: string, id: string, maxAgeMs: number, now: number): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'));
  } catch {
    return undefined;
  }
  // Files written before the envelope existed carry no load time: treat as a miss.
  if (!isEnvelope(parsed)) return undefined;
  const age = now - parsed.t;
  if (age > maxAgeMs || age < -MEMO_CLOCK_SKEW_MS) return undefined;
  return parsed.v;
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

function writeDisk(dir: string, id: string, value: unknown, now: number): void {
  // `undefined` has no JSON form; the envelope would silently drop `v`.
  if (value === undefined) return;
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return;
  }
  let json: string | undefined;
  try {
    const envelope: MemoEnvelope = { t: now, v: value };
    json = JSON.stringify(envelope);
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

async function readOrLoad<T>(
  dir: string,
  id: string,
  load: () => Promise<T>,
  maxAgeMs: number,
  clock: () => number,
): Promise<T> {
  const cached = readDisk(dir, id, maxAgeMs, clock());
  // Disk JSON is untyped; the loader's Result is the contract for this key.
  if (cached !== undefined) return cached as T;
  const value = await load();
  writeDisk(dir, id, value, clock());
  return value;
}

/**
 * During `next build`, identical public reads share one in-process Promise and a
 * JSON file under `.next/cache` so the 11 SSG workers do not each hit PostgREST
 * for `getCategories` / related / adjacent. Runtime ISR still uses Next Data Cache
 * + `revalidateTag` — this memo is build-only so publish invalidation stays honest.
 *
 * The disk file must never outlive its own build: Vercel restores `.next/cache`
 * into the next deploy, and an unbounded memo pinned every prerender (pages,
 * sitemaps, `generateStaticParams`) to the DB state of the first build that wrote
 * it. Entries are therefore scoped to the deployment id, stamped with their load
 * time and ignored after `MEMO_MAX_AGE_MS`.
 */
export async function withBuildMemo<T>(
  key: string,
  args: readonly unknown[],
  load: () => Promise<T>,
  options?: MemoOptions,
): Promise<T> {
  const enabled = options?.enabled ?? isProductionBuild();
  if (!enabled) return load();

  const base = options?.dir ?? defaultCacheDir();
  const dir = scopeDir(base, options?.scope ?? defaultScope());
  // Key the in-process map by dir too: a different build scope must not reuse it.
  const id = publicContentMemoKey(key, args);
  const inflightKey = `${dir}\0${id}`;
  const pending = inflight.get(inflightKey);
  if (pending) return pending as Promise<T>; // Map stores Promise<unknown> across keys

  pruneStaleScopes(base, dir);
  const promise = readOrLoad(
    dir,
    id,
    load,
    options?.maxAgeMs ?? MEMO_MAX_AGE_MS,
    options?.now ?? Date.now,
  );
  inflight.set(inflightKey, promise);
  try {
    return await promise;
  } catch (error) {
    inflight.delete(inflightKey);
    throw error;
  }
}
