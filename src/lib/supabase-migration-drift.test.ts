import { describe, expect, it } from 'vitest';
import {
  findMainMigrationsMissingOnProd,
  migrationFilenameToVersion,
} from './supabase-migration-drift';

describe('migration drift', () => {
  it('extracts the timestamp prefix from a migration filename', () => {
    expect(
      migrationFilenameToVersion(
        'supabase/migrations/20260821170000_weekly_release_autopilot_ship_and_attest_hardening.sql',
      ),
    ).toBe('20260821170000');
  });

  it('fails when a main-branch migration is absent from prod', () => {
    expect(
      findMainMigrationsMissingOnProd({
        mainFilenames: [
          '20260821160000_weekly_release_autopilot.sql',
          '20260821170000_weekly_release_autopilot_ship_and_attest_hardening.sql',
        ],
        prodVersions: ['20260821160000'],
      }),
    ).toEqual(['20260821170000']);
  });

  it('ignores a branch-only migration that is not on main yet', () => {
    expect(
      findMainMigrationsMissingOnProd({
        mainFilenames: ['20260821160000_weekly_release_autopilot.sql'],
        prodVersions: ['20260821160000'],
      }),
    ).toEqual([]);
  });
});
