/**
 * Compare committed migration files against prod `schema_migrations`.
 * A file on origin/main with no matching prod row is the 2026-08-28
 * ship_weekly_digest class of bug: code merged, function never applied.
 *
 * Prod `version` is often the apply clock, not the filename prefix, so we
 * also match `schema_migrations.name` (slug / full stem).
 */

export function migrationFilenameToStem(filename: string): string {
  const base = filename.replace(/\\/g, '/').split('/').pop() ?? filename;
  return base.endsWith('.sql') ? base.slice(0, -4) : base;
}

export function migrationFilenameToVersion(filename: string): string {
  const match = /^(\d+)/.exec(migrationFilenameToStem(filename));
  return match?.[1] ?? migrationFilenameToStem(filename);
}

export function migrationFilenameToSlug(filename: string): string {
  const stem = migrationFilenameToStem(filename);
  const timestamped = /^(\d{14})_(.+)$/.exec(stem);
  if (timestamped?.[2]) return timestamped[2];
  const numbered = /^(\d{3})_(.+)$/.exec(stem);
  if (numbered?.[2]) return numbered[2];
  return stem;
}

/** Filename-as-version era. Numbered 001–040 used a different apply clock. */
export const MIGRATION_DRIFT_WATCH_FROM = '20260801000000';

export function isWatchedMigrationFilename(filename: string): boolean {
  const stem = migrationFilenameToStem(filename);
  const timestamped = /^(\d{14})_/.exec(stem);
  return Boolean(timestamped?.[1] && timestamped[1] >= MIGRATION_DRIFT_WATCH_FROM);
}

function strippedName(name: string): string | null {
  const timestamped = /^(\d{14})_(.+)$/.exec(name);
  if (timestamped?.[2]) return timestamped[2];
  const numbered = /^(\d{3})_(.+)$/.exec(name);
  if (numbered?.[2]) return numbered[2];
  return null;
}

function prodKeySet(input: { prodVersions: string[]; prodNames?: string[] }): Set<string> {
  const keys = new Set<string>();
  for (const version of input.prodVersions) {
    if (version) keys.add(version);
  }
  for (const name of input.prodNames ?? []) {
    if (!name) continue;
    keys.add(name);
    const stripped = strippedName(name);
    if (stripped) keys.add(stripped);
  }
  return keys;
}

export function findMainMigrationsMissingOnProd(input: {
  mainFilenames: string[];
  prodVersions: string[];
  prodNames?: string[];
}): string[] {
  const prod = prodKeySet(input);
  const missing = new Set<string>();
  for (const filename of input.mainFilenames) {
    if (!isWatchedMigrationFilename(filename)) continue;
    const version = migrationFilenameToVersion(filename);
    const stem = migrationFilenameToStem(filename);
    const slug = migrationFilenameToSlug(filename);
    if (prod.has(version) || prod.has(stem) || prod.has(slug)) continue;
    missing.add(version);
  }
  return [...missing].sort((left, right) => left.localeCompare(right));
}
