'use client';

import { useState } from 'react';
import { ActionSubmitButton } from '@/components/admin/action-submit-button';
import { uploadWeeklyArtifactAction } from '@/app/admin/(cms)/weekly/actions';
import {
  formatWeeklyUploadByteLimit,
  humanizeWeeklyUploadError,
  WEEKLY_ARTIFACT_UPLOAD_MAX_BYTES,
  WEEKLY_ARTIFACT_UPLOAD_SAFE_BODY_BYTES,
  weeklyUploadExceedsServerLimit,
  weeklyUploadNeedsClientCompress,
} from '@/lib/weekly-digest/admin-upload-limits';
import { STORY_IMAGE_HEIGHT, STORY_IMAGE_WIDTH } from '@/lib/encode-site-image';

const FIELD =
  'min-h-11 w-full rounded-xl border border-white/12 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-[#47e4d3] focus:outline-none';
const TEXTAREA = `${FIELD} resize-y leading-6`;
const LABEL = 'grid gap-2 text-sm font-semibold text-slate-200';
const SECONDARY =
  'min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-slate-200 transition hover:border-white/30 hover:bg-white/[.04]';

type UploadArtifactType = 'cover' | 'story_image' | 'social_asset' | 'pdf' | 'thumbnail';

/**
 * Draw the source onto a 16:9 canvas (contain) and emit a JPEG small enough for
 * the Vercel Server Action body budget. The Server Action still re-encodes with
 * sharp; this step only makes the POST reachable.
 */
async function compressImageForWeeklyUpload(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = STORY_IMAGE_WIDTH;
    canvas.height = STORY_IMAGE_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare a browser canvas for image compression.');
    context.fillStyle = '#101418';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const drawWidth = bitmap.width * scale;
    const drawHeight = bitmap.height * scale;
    context.drawImage(
      bitmap,
      (canvas.width - drawWidth) / 2,
      (canvas.height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (!value) reject(new Error('Browser image compression produced an empty file.'));
          else resolve(value);
        },
        'image/jpeg',
        0.9,
      );
    });
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'upload';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

async function prepareUploadFile(file: File, artifactType: UploadArtifactType): Promise<File> {
  if (weeklyUploadExceedsServerLimit(file.size)) {
    throw new Error(
      `Replacement files are limited to ${formatWeeklyUploadByteLimit(WEEKLY_ARTIFACT_UPLOAD_MAX_BYTES)}.`,
    );
  }
  if (artifactType === 'pdf') {
    if (weeklyUploadNeedsClientCompress(file.size)) {
      throw new Error(
        `PDF uploads must stay under ${formatWeeklyUploadByteLimit(WEEKLY_ARTIFACT_UPLOAD_SAFE_BODY_BYTES)} on the current hosting plan. Compress the PDF, then try again.`,
      );
    }
    return file;
  }
  if (!weeklyUploadNeedsClientCompress(file.size)) return file;
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
    throw new Error('The replacement is not a supported image.');
  }
  const compressed = await compressImageForWeeklyUpload(file);
  if (weeklyUploadNeedsClientCompress(compressed.size)) {
    throw new Error(
      `Even after local compression the file is still over ${formatWeeklyUploadByteLimit(WEEKLY_ARTIFACT_UPLOAD_SAFE_BODY_BYTES)}. Export a smaller JPEG/WebP and retry.`,
    );
  }
  return compressed;
}

export function WeeklyReplacementUploadForm({
  weeklyDigestId,
  revisionId,
  artifactType,
  slotKey,
  canEdit,
  revisionItemId,
  locale = 'neutral',
}: {
  weeklyDigestId: string;
  revisionId: string;
  artifactType: UploadArtifactType;
  slotKey: string;
  canEdit: boolean;
  revisionItemId?: string;
  locale?: 'neutral' | 'en' | 'uk';
}) {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function formAction(formData: FormData) {
    const raw = formData.get('file');
    if (!(raw instanceof File) || raw.size === 0) {
      setError('Select a replacement file.');
      setNote(null);
      return;
    }
    setError(null);
    setNote(null);
    try {
      const prepared = await prepareUploadFile(raw, artifactType);
      if (prepared !== raw) {
        formData.set('file', prepared);
        setNote(
          `Locally compressed ${formatWeeklyUploadByteLimit(raw.size)} → ${formatWeeklyUploadByteLimit(prepared.size)} so the upload fits the hosting body limit.`,
        );
      }
      await uploadWeeklyArtifactAction(formData);
      setNote((current) => current ?? 'Upload staged. Reload if the preview does not appear yet.');
    } catch (uploadError) {
      // Server Action redirect(?save_error=) must keep propagating; only real
      // failures stay on this card.
      if (
        typeof uploadError === 'object' &&
        uploadError !== null &&
        'digest' in uploadError &&
        typeof (uploadError as { digest: unknown }).digest === 'string' &&
        (uploadError as { digest: string }).digest.startsWith('NEXT_REDIRECT')
      ) {
        throw uploadError;
      }
      setError(humanizeWeeklyUploadError(uploadError));
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
      <form action={formAction} className="grid gap-3">
        <input type="hidden" name="weekly_digest_id" value={weeklyDigestId} />
        <input type="hidden" name="revision_id" value={revisionId} />
        <input type="hidden" name="artifact_type" value={artifactType} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="slot_key" value={slotKey} />
        {revisionItemId ? (
          <input type="hidden" name="revision_item_id" value={revisionItemId} />
        ) : null}
        <p className="text-sm font-bold text-slate-300">Upload a replacement</p>
        <p className="text-xs leading-5 text-slate-500">
          Images larger than {formatWeeklyUploadByteLimit(WEEKLY_ARTIFACT_UPLOAD_SAFE_BODY_BYTES)}{' '}
          are compressed in the browser first (Vercel request-body limit). The server still
          re-encodes to the site canvas.
        </p>
        <label className={LABEL}>
          File
          <input
            type="file"
            name="file"
            required
            accept={artifactType === 'pdf' ? 'application/pdf' : 'image/*'}
            disabled={!canEdit}
            data-testid={artifactType === 'story_image' ? 'story-image-upload-file' : undefined}
            className={`${FIELD} file:mr-3 file:rounded-lg file:border-0 file:bg-[#47e4d3]/10 file:px-3 file:py-1 file:font-bold file:text-[#47e4d3]`}
          />
        </label>
        <label className={LABEL}>
          Alt text
          <textarea
            name="alt_text"
            rows={2}
            required={artifactType !== 'pdf'}
            disabled={!canEdit}
            className={TEXTAREA}
          />
        </label>
        {artifactType !== 'pdf' ? (
          <label className={LABEL}>
            Focal point
            <select
              name="focal_point"
              defaultValue="attention"
              disabled={!canEdit}
              className={FIELD}
            >
              <option value="attention">Automatic attention</option>
              <option value="centre">Centre</option>
              <option value="north">Top</option>
              <option value="south">Bottom</option>
              <option value="west">Left</option>
              <option value="east">Right</option>
            </select>
          </label>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-300/35 bg-rose-300/10 px-3 py-2 text-xs leading-5 text-rose-100"
          >
            {error}
          </p>
        ) : null}
        {note && !error ? (
          <p className="rounded-xl border border-cyan-300/25 bg-cyan-300/8 px-3 py-2 text-xs leading-5 text-cyan-100">
            {note}
          </p>
        ) : null}
        <ActionSubmitButton
          idleLabel="Upload and stage replacement"
          pendingLabel="Uploading replacement…"
          disabled={!canEdit}
          className={SECONDARY}
        />
      </form>

      <details className="border-t border-white/8 pt-3">
        <summary className="text-xs font-bold text-slate-400">Need a remote file?</summary>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Download the file first, then upload it here. Direct URL import is intentionally disabled
          so the review pipeline can verify the exact bytes, MIME type, dimensions, and PDF file.
        </p>
      </details>
    </div>
  );
}
