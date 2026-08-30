import { describe, expect, it } from 'vitest';
import {
  findMainMigrationsMissingOnProd,
  isWatchedMigrationFilename,
  migrationFilenameToSlug,
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

  it('extracts the filename slug after the timestamp', () => {
    expect(
      migrationFilenameToSlug(
        'supabase/migrations/20260824100000_daily_visual_workflow.sql',
      ),
    ).toBe('daily_visual_workflow');
  });

  it('watches timestamped August 2026 files and ignores numbered 001–040', () => {
    expect(isWatchedMigrationFilename('001_initial_schema.sql')).toBe(false);
    expect(isWatchedMigrationFilename('20260730100000_find_duplicate_item_pairs.sql')).toBe(
      false,
    );
    expect(isWatchedMigrationFilename('20260824100000_daily_visual_workflow.sql')).toBe(true);
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

  it('treats a file as applied when prod recorded the slug under a different version', () => {
    expect(
      findMainMigrationsMissingOnProd({
        mainFilenames: ['20260824100000_daily_visual_workflow.sql'],
        prodVersions: ['20260824100143'],
        prodNames: ['daily_visual_workflow'],
      }),
    ).toEqual([]);
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
