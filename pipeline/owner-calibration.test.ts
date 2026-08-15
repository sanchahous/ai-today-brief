import { describe, expect, it } from 'vitest';
import {
  outPathFromArgs,
  rowsFromArtifacts,
  DEFAULT_OUT_PATH,
  type OwnerCalibrationArtifactRow,
} from './owner-calibration';

function artifact(partial: Partial<OwnerCalibrationArtifactRow> = {}): OwnerCalibrationArtifactRow {
  return {
    weekly_digest_id: 'digest-1',
    revision_id: 'revision-1',
    revision_item_id: 'item-1',
    slot_key: 'story-prompt-set:item-1',
    content: null,
    ...partial,
  };
}

describe('rowsFromArtifacts', () => {
  it('flattens owner_feedback from one artifact into per-concept rows', () => {
    const rows = rowsFromArtifacts([
      artifact({
        content: {
          owner_feedback: {
            mechanism: {
              verdict: 'used_with_edits',
              reasonTags: ['good_concept_bad_execution'],
              recordedAt: '2026-08-15T12:00:00.000Z',
              promptTitle: 'Teleprinter adapter',
              canonical: 'A brass adapter card being pushed into a teleprinter terminal.',
            },
          },
        },
      }),
    ]);
    expect(rows).toEqual([
      {
        weeklyDigestId: 'digest-1',
        revisionId: 'revision-1',
        revisionItemId: 'item-1',
        slotKey: 'story-prompt-set:item-1',
        conceptLens: 'mechanism',
        verdict: 'used_with_edits',
        reasonTags: ['good_concept_bad_execution'],
        recordedAt: '2026-08-15T12:00:00.000Z',
        promptTitle: 'Teleprinter adapter',
        canonical: 'A brass adapter card being pushed into a teleprinter terminal.',
      },
    ]);
  });

  it('an artifact with no owner_feedback contributes no rows', () => {
    expect(rowsFromArtifacts([artifact({ content: { prompts: [] } })])).toEqual([]);
    expect(rowsFromArtifacts([artifact({ content: null })])).toEqual([]);
  });

  it('rolls up multiple concepts across multiple artifacts, sorted by concept lens', () => {
    const rows = rowsFromArtifacts([
      artifact({
        revision_item_id: 'item-1',
        content: {
          owner_feedback: {
            consequence: {
              verdict: 'rejected',
              reasonTags: ['weak_visual_thesis'],
              recordedAt: '2026-08-15T12:05:00.000Z',
              promptTitle: 'One connected tool',
              canonical: null,
            },
            literal_context: {
              verdict: 'used',
              reasonTags: [],
              recordedAt: '2026-08-15T12:00:00.000Z',
              promptTitle: 'Cartridge in the port',
              canonical: null,
            },
          },
        },
      }),
      artifact({
        revision_item_id: 'item-2',
        slot_key: 'story-prompt-set:item-2',
        content: {
          owner_feedback: {
            owner_direction: {
              verdict: 'used',
              reasonTags: ['domain_context_success'],
              recordedAt: '2026-08-15T12:10:00.000Z',
              promptTitle: 'Owner direction',
              canonical: null,
            },
          },
        },
      }),
    ]);
    expect(rows.map((row) => [row.revisionItemId, row.conceptLens])).toEqual([
      ['item-1', 'consequence'],
      ['item-1', 'literal_context'],
      ['item-2', 'owner_direction'],
    ]);
  });
});

describe('outPathFromArgs', () => {
  it('defaults to the critic-ground-truth path', () => {
    expect(outPathFromArgs([])).toBe(DEFAULT_OUT_PATH);
  });

  it('honors an explicit --out flag', () => {
    expect(outPathFromArgs(['--out', 'tmp/custom.json'])).toBe('tmp/custom.json');
  });
});
