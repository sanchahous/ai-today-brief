import { describe, expect, it } from 'vitest';
import {
  formatWeeklyUploadByteLimit,
  humanizeWeeklyUploadError,
  WEEKLY_ARTIFACT_UPLOAD_MAX_BYTES,
  WEEKLY_ARTIFACT_UPLOAD_SAFE_BODY_BYTES,
  weeklyUploadExceedsServerLimit,
  weeklyUploadNeedsClientCompress,
} from './admin-upload-limits';

describe('admin-upload-limits', () => {
  it('flags bodies that would hit the Vercel request-body cap', () => {
    expect(weeklyUploadNeedsClientCompress(WEEKLY_ARTIFACT_UPLOAD_SAFE_BODY_BYTES)).toBe(false);
    expect(weeklyUploadNeedsClientCompress(WEEKLY_ARTIFACT_UPLOAD_SAFE_BODY_BYTES + 1)).toBe(true);
  });

  it('keeps the Server Action 12 MB ceiling separate from the safe body budget', () => {
    expect(WEEKLY_ARTIFACT_UPLOAD_MAX_BYTES).toBeGreaterThan(WEEKLY_ARTIFACT_UPLOAD_SAFE_BODY_BYTES);
    expect(weeklyUploadExceedsServerLimit(WEEKLY_ARTIFACT_UPLOAD_MAX_BYTES)).toBe(false);
    expect(weeklyUploadExceedsServerLimit(WEEKLY_ARTIFACT_UPLOAD_MAX_BYTES + 1)).toBe(true);
  });

  it('formats byte limits for owner-facing copy', () => {
    expect(formatWeeklyUploadByteLimit(3.5 * 1024 * 1024)).toBe('3.5 MB');
    expect(formatWeeklyUploadByteLimit(12 * 1024 * 1024)).toBe('12 MB');
  });

  it('rewrites Next transport failures into a body-cap explanation', () => {
    expect(
      humanizeWeeklyUploadError(new Error('An unexpected response was received from the server.')),
    ).toMatch(/4\.5 MB/);
    expect(humanizeWeeklyUploadError(new Error('Select a replacement file.'))).toBe(
      'Select a replacement file.',
    );
  });
});
