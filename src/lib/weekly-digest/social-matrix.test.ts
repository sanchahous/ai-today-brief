import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEEKLY_SOCIAL_MATRIX, weeklySocialMatrixTuples } from './social-matrix';

const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20260821160000_weekly_release_autopilot.sql',
);

describe('WEEKLY_SOCIAL_MATRIX', () => {
  it('matches the SQL weekly_digest_social_matrix seed (TS ≡ SQL)', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const insert = sql.slice(
      sql.indexOf('insert into public.weekly_digest_social_matrix'),
      sql.indexOf('on conflict (channel)'),
    );
    const fromSql = [...insert.matchAll(/\('([a-z]+)',\s*'([a-z]+)'\)/g)]
      .map((match) => [match[1], match[2]] as [string, string])
      .sort((left, right) => left[0].localeCompare(right[0]));
    expect(fromSql).toEqual(weeklySocialMatrixTuples());
    expect(WEEKLY_SOCIAL_MATRIX.threads).toBe('uk');
  });
});
