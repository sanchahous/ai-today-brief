/**
 * CMS weekly artifact uploads go through a Next.js Server Action on Vercel.
 * Hobby/Pro still hard-cap the request body at 4.5 MB before our action runs;
 * oversized multipart POSTs never reach the function and the browser shows
 * Next's opaque "An unexpected response was received from the server."
 *
 * Keep the Server Action ceiling (12 MB) for when hosting allows it, but the
 * admin UI must stay under the platform body budget (with multipart overhead).
 */

/** Server Action validation ceiling (after the request already arrived). */
export const WEEKLY_ARTIFACT_UPLOAD_MAX_BYTES = 12 * 1024 * 1024;

/**
 * Safe multipart body budget for Vercel Hobby/Pro (4.5 MB request body).
 * Leave headroom for form fields and multipart framing.
 */
export const WEEKLY_ARTIFACT_UPLOAD_SAFE_BODY_BYTES = Math.floor(3.5 * 1024 * 1024);

const TRANSPORT_FAILURE =
  /unexpected response was received from the server|failed to fetch|networkerror|load failed/i;

export function weeklyUploadNeedsClientCompress(byteSize: number): boolean {
  return byteSize > WEEKLY_ARTIFACT_UPLOAD_SAFE_BODY_BYTES;
}

export function weeklyUploadExceedsServerLimit(byteSize: number): boolean {
  return byteSize > WEEKLY_ARTIFACT_UPLOAD_MAX_BYTES;
}

export function formatWeeklyUploadByteLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Map framework/network failures to an owner-facing explanation. Real action
 * errors (validation, sharp, Storage) keep their original message.
 */
export function humanizeWeeklyUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (TRANSPORT_FAILURE.test(message)) {
    return (
      `The file did not reach the upload handler. On the current Vercel plan the ` +
      `request body is capped near 4.5 MB — export a JPEG/WebP under ` +
      `${formatWeeklyUploadByteLimit(WEEKLY_ARTIFACT_UPLOAD_SAFE_BODY_BYTES)}, ` +
      `or let this form compress the image locally before retrying.`
    );
  }
  return message || 'Upload failed.';
}
