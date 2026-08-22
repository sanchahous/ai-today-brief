import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEEKLY_SOCIAL_MATRIX, weeklySocialMatrixTuples } from './social-matrix';

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations');

/** The seed statement lives in whichever migration last touched the matrix. */
function findSeedSql(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .reverse();
  for (const file of files) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8');
    const start = sql.indexOf('insert into public.weekly_digest_social_matrix');
    const end = sql.indexOf('on conflict (channel)', start);
    if (start >= 0 && end > start) return sql.slice(start, end);
  }
  throw new Error('weekly_digest_social_matrix seed not found in migrations');
}

describe('WEEKLY_SOCIAL_MATRIX', () => {
  it('matches the SQL weekly_digest_social_matrix seed (TS ≡ SQL)', () => {
    const insert = findSeedSql();
    const fromSql = [...insert.matchAll(/\('([a-z]+)',\s*'([a-z]+)'\)/g)]
      .map((match) => [match[1]!, match[2]!] as [string, string])
      .sort((left, right) => left[0].localeCompare(right[0]));
    expect(fromSql).toEqual(weeklySocialMatrixTuples());
    expect(WEEKLY_SOCIAL_MATRIX.threads).toBe('uk');
  });
});
