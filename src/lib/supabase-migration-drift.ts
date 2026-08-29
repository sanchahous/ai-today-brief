/**
 * Compare committed migration versions against prod `schema_migrations`.
 * A version on origin/main that is missing in prod is the 2026-08-28
 * ship_weekly_digest class of bug: code merged, function never applied.
 */

export function migrationFilenameToVersion(filename: string): string {
  const base = filename.replace(/\\/g, '/').split('/').pop() ?? filename;
  const stem = base.endsWith('.sql') ? base.slice(0, -4) : base;
  const match = /^(\d+)/.exec(stem);
  return match?.[1] ?? stem;
}

export function findMainMigrationsMissingOnProd(input: {
  mainFilenames: string[];
  prodVersions: string[];
}): string[] {
  const prod = new Set(input.prodVersions);
  const missing = new Set<string>();
  for (const filename of input.mainFilenames) {
    const version = migrationFilenameToVersion(filename);
    if (!prod.has(version)) missing.add(version);
  }
  return [...missing].sort((left, right) => left.localeCompare(right));
}
