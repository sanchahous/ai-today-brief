import { describe, expect, it } from 'vitest';
import { MAX_CANCEL_PACKAGES, parseCancelPackageIds } from './package-ids';

const ID_A = '123e4567-e89b-12d3-a456-426614174000';
const ID_B = '223e4567-e89b-12d3-a456-426614174000';

function form(entries: Array<[string, string]>) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe('parseCancelPackageIds', () => {
  it('reads a single editor id', () => {
    expect(parseCancelPackageIds(form([['id', ID_A]]))).toEqual([ID_A]);
  });

  it('reads unique package_id values from the queue', () => {
    expect(
      parseCancelPackageIds(
        form([
          ['package_id', ID_A],
          ['package_id', ID_B],
          ['package_id', ID_A],
        ]),
      ),
    ).toEqual([ID_A, ID_B]);
  });

  it('merges id and package_id without duplicating', () => {
    expect(
      parseCancelPackageIds(
        form([
          ['id', ID_A],
          ['package_id', ID_A],
          ['package_id', ID_B],
        ]),
      ),
    ).toEqual([ID_A, ID_B]);
  });

  it('rejects an empty selection', () => {
    expect(() => parseCancelPackageIds(form([]))).toThrow('Select at least one package.');
  });

  it('trims surrounding whitespace', () => {
    expect(parseCancelPackageIds(form([['id', `  ${ID_A}  `]]))).toEqual([ID_A]);
  });

  it('rejects a malformed id', () => {
    expect(() => parseCancelPackageIds(form([['package_id', 'not-a-uuid']]))).toThrow(
      'A package id is invalid.',
    );
  });

  it('rejects more ids than the queue can show', () => {
    const entries: Array<[string, string]> = Array.from(
      { length: MAX_CANCEL_PACKAGES + 1 },
      (_, i) => {
        const n = String(i + 1).padStart(12, '0');
        return ['package_id', `123e4567-e89b-12d3-a456-${n}`];
      },
    );
    expect(() => parseCancelPackageIds(form(entries))).toThrow(
      `Cannot cancel more than ${MAX_CANCEL_PACKAGES} packages at once.`,
    );
  });
});
