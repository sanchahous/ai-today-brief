import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { Database, Json } from '@/lib/database.types';
import { storageBlob } from '@/lib/storage/binary';
import type { PipelineDb } from './db';

export const DAILY_VISUAL_PRIVATE_BUCKET = 'daily-visual-private';
export const DAILY_VISUAL_PUBLIC_BUCKET = 'social-assets';
export const DAILY_VISUAL_MASTER_WIDTH = 1600;
export const DAILY_VISUAL_MASTER_HEIGHT = 900;

type CandidateKind =
  Database['public']['Tables']['daily_visual_candidates']['Row']['candidate_kind'];
type CandidateRow = Database['public']['Tables']['daily_visual_candidates']['Row'];

export interface StoredDailyVisualCandidate {
  id: string;
  kind: CandidateKind;
  storageBucket: string;
  storagePath: string;
  sha256: string;
  width: number;
  height: number;
  bytes: number;
}

export interface PrivateCandidateInput {
  editorialDate: string;
  dailyVisualSetId: string;
  kind: CandidateKind;
  attemptNumber: number;
  bytes: Buffer;
  provider?: string | null;
  model?: string | null;
  prompt?: string | null;
  promptHash?: string | null;
  parentCandidateId?: string | null;
  sourceUrl?: string | null;
  rightsNote?: string | null;
}

function digest(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function candidatePath(input: PrivateCandidateInput, sha256: string): string {
  const safeDate = input.editorialDate.replace(/[^0-9-]/g, '');
  return `${safeDate}/${input.dailyVisualSetId}/${input.kind}-${input.attemptNumber}-${sha256}.webp`;
}

type StoredCandidateRow = Pick<
  CandidateRow,
  | 'id'
  | 'candidate_kind'
  | 'storage_bucket'
  | 'storage_path'
  | 'sha256'
  | 'width'
  | 'height'
  | 'byte_size'
>;

function asStoredCandidate(row: StoredCandidateRow): StoredDailyVisualCandidate {
  return {
    id: row.id,
    kind: row.candidate_kind,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    sha256: row.sha256,
    width: row.width,
    height: row.height,
    bytes: row.byte_size,
  };
}

/**
 * The provider’s landscape output is normalized into a true 16:9 master with
 * `contain`, never crop. The dark branded margin protects every semantic edge
 * in heroes and then becomes a stable source for social derivatives.
 */
export async function normalizeDailyVisualMaster(input: Buffer): Promise<Buffer> {
  const output = await sharp(input, { limitInputPixels: 20_000_000, failOn: 'warning' })
    .rotate()
    .resize(DAILY_VISUAL_MASTER_WIDTH, DAILY_VISUAL_MASTER_HEIGHT, {
      fit: 'contain',
      background: { r: 11, g: 22, b: 35, alpha: 1 },
    })
    .webp({ quality: 90, effort: 5 })
    .toBuffer();
  if (output.length === 0 || output.length > 10 * 1024 * 1024) {
    throw new Error('Normalized daily visual is empty or exceeds the private storage limit.');
  }
  return output;
}

/** Zero-cost alternate for manual choice only; its imagery is never auto-activated. */
export async function renderBrandedDailyVisualFallback(): Promise<Buffer> {
  const svg = Buffer.from(`
    <svg width="${DAILY_VISUAL_MASTER_WIDTH}" height="${DAILY_VISUAL_MASTER_HEIGHT}" viewBox="0 0 ${DAILY_VISUAL_MASTER_WIDTH} ${DAILY_VISUAL_MASTER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0b1623"/>
          <stop offset="1" stop-color="#172c43"/>
        </linearGradient>
        <linearGradient id="route" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#1c86c9"/>
          <stop offset="1" stop-color="#47e4d3"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <g fill="none" stroke="#28465f" stroke-width="8" opacity=".85">
        <path d="M190 455 H540 M1060 455 H1410"/>
        <path d="M540 455 C680 455 680 270 800 270 C920 270 920 455 1060 455"/>
        <path d="M540 455 C680 455 680 640 800 640 C920 640 920 455 1060 455"/>
      </g>
      <path d="M190 455 H540 C680 455 680 270 800 270 C920 270 920 455 1060 455 H1410" fill="none" stroke="url(#route)" stroke-width="18" stroke-linecap="round"/>
      <circle cx="190" cy="455" r="46" fill="#1c86c9"/>
      <circle cx="800" cy="270" r="62" fill="#47e4d3"/>
      <circle cx="1410" cy="455" r="46" fill="#47e4d3"/>
      <circle cx="800" cy="640" r="42" fill="#172c43" stroke="#28465f" stroke-width="8"/>
    </svg>
  `);
  return sharp(svg).webp({ quality: 90, effort: 5 }).toBuffer();
}

async function verifyStoredBytes(
  db: PipelineDb,
  bucket: string,
  path: string,
  expected: Buffer,
): Promise<void> {
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(
      `[daily-visual] storage verification failed: ${error?.message ?? 'empty object'}`,
    );
  }
  const stored = Buffer.from(await data.arrayBuffer());
  if (!stored.equals(expected))
    throw new Error('[daily-visual] storage verification bytes differ.');
}

export async function findPrivateDailyVisualCandidate(
  db: PipelineDb,
  dailyVisualSetId: string,
  kind: CandidateKind,
  attemptNumber: number,
): Promise<StoredDailyVisualCandidate | null> {
  const { data, error } = await db
    .from('daily_visual_candidates')
    .select('id,candidate_kind,storage_bucket,storage_path,sha256,width,height,byte_size')
    .eq('daily_visual_set_id', dailyVisualSetId)
    .eq('candidate_kind', kind)
    .eq('attempt_number', attemptNumber)
    .maybeSingle();
  if (error) throw new Error(`[daily-visual] candidate lookup failed: ${error.message}`);
  return data ? asStoredCandidate(data) : null;
}

export async function persistPrivateDailyVisualCandidate(
  db: PipelineDb,
  input: PrivateCandidateInput,
): Promise<StoredDailyVisualCandidate> {
  // Normalize before idempotency lookup. A simultaneous editor upload must
  // never quietly select another person's bytes just because it raced for the
  // same immutable kind/attempt slot.
  const bytes = await normalizeDailyVisualMaster(input.bytes);
  const sha256 = digest(bytes);
  const prior = await findPrivateDailyVisualCandidate(
    db,
    input.dailyVisualSetId,
    input.kind,
    input.attemptNumber,
  );
  if (prior) {
    if (prior.sha256 !== sha256) {
      throw new Error(
        '[daily-visual] immutable candidate slot is already occupied by different bytes.',
      );
    }
    return prior;
  }
  const path = candidatePath(input, sha256);
  const { error: uploadError } = await db.storage
    .from(DAILY_VISUAL_PRIVATE_BUCKET)
    .upload(path, storageBlob(bytes, 'image/webp'), {
      contentType: 'image/webp',
      cacheControl: '31536000, immutable',
      upsert: false,
    });
  if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
    throw new Error(`[daily-visual] private upload failed: ${uploadError.message}`);
  }
  await verifyStoredBytes(db, DAILY_VISUAL_PRIVATE_BUCKET, path, bytes);

  const { data, error } = await db
    .from('daily_visual_candidates')
    .insert({
      daily_visual_set_id: input.dailyVisualSetId,
      candidate_kind: input.kind,
      attempt_number: input.attemptNumber,
      parent_candidate_id: input.parentCandidateId ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
      prompt: input.prompt ?? null,
      prompt_hash: input.promptHash ?? null,
      storage_bucket: DAILY_VISUAL_PRIVATE_BUCKET,
      storage_path: path,
      sha256,
      mime_type: 'image/webp',
      width: DAILY_VISUAL_MASTER_WIDTH,
      height: DAILY_VISUAL_MASTER_HEIGHT,
      byte_size: bytes.length,
      source_url: input.sourceUrl ?? null,
      rights_note: input.rightsNote ?? null,
    })
    .select('id,candidate_kind,storage_bucket,storage_path,sha256,width,height,byte_size')
    .single();
  if (error || !data) {
    const raced = await findPrivateDailyVisualCandidate(
      db,
      input.dailyVisualSetId,
      input.kind,
      input.attemptNumber,
    );
    if (raced) {
      // A unique-slot collision is only idempotent when both writers produced
      // the very same normalized bytes. Returning a different candidate here
      // would let one editor's action silently activate another editor's
      // upload after a race.
      if (raced.sha256 !== sha256) {
        throw new Error('[daily-visual] immutable candidate slot raced with different bytes.');
      }
      return raced;
    }
    throw new Error(`[daily-visual] candidate record failed: ${error?.message ?? 'no row'}`);
  }
  return asStoredCandidate(data);
}

export async function recordDailyVisualQa(
  db: PipelineDb,
  input: {
    candidateId: string;
    stage: 'deterministic' | 'image_only' | 'story_semantic';
    outcome: 'passed' | 'failed' | 'error';
    report: Json;
    provider?: string | null;
    model?: string | null;
  },
): Promise<void> {
  const { error } = await db.from('daily_visual_candidate_qa').insert({
    candidate_id: input.candidateId,
    stage: input.stage,
    outcome: input.outcome,
    report: input.report,
    provider: input.provider ?? null,
    model: input.model ?? null,
  });
  if (error && !/duplicate key/i.test(error.message)) {
    throw new Error(`[daily-visual] QA record failed: ${error.message}`);
  }
}

export async function promoteDailyVisualCandidate(
  db: PipelineDb,
  input: { editorialDate: string; candidate: StoredDailyVisualCandidate },
): Promise<{ publicUrl: string; width: number; height: number }> {
  const { data, error } = await db.storage
    .from(input.candidate.storageBucket)
    .download(input.candidate.storagePath);
  if (error || !data) {
    throw new Error(
      `[daily-visual] private candidate download failed: ${error?.message ?? 'empty object'}`,
    );
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (digest(bytes) !== input.candidate.sha256) {
    throw new Error('[daily-visual] private candidate hash mismatch before promotion.');
  }
  const publicPath = `daily/${input.editorialDate}/${input.candidate.sha256}.webp`;
  const { error: uploadError } = await db.storage
    .from(DAILY_VISUAL_PUBLIC_BUCKET)
    .upload(publicPath, storageBlob(bytes, 'image/webp'), {
      contentType: 'image/webp',
      cacheControl: '31536000, immutable',
      upsert: false,
    });
  if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
    throw new Error(`[daily-visual] public promotion failed: ${uploadError.message}`);
  }
  await verifyStoredBytes(db, DAILY_VISUAL_PUBLIC_BUCKET, publicPath, bytes);
  const publicUrl = db.storage.from(DAILY_VISUAL_PUBLIC_BUCKET).getPublicUrl(publicPath)
    .data.publicUrl;
  if (!publicUrl) throw new Error('[daily-visual] public storage URL was empty.');
  return { publicUrl, width: input.candidate.width, height: input.candidate.height };
}

/** Read the immutable, normalized master that will be promoted if it passes QA. */
export async function loadPrivateDailyVisualCandidateBytes(
  db: PipelineDb,
  candidate: StoredDailyVisualCandidate,
): Promise<Buffer> {
  const { data, error } = await db.storage
    .from(candidate.storageBucket)
    .download(candidate.storagePath);
  if (error || !data) {
    throw new Error(
      `[daily-visual] private candidate download failed: ${error?.message ?? 'empty object'}`,
    );
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (digest(bytes) !== candidate.sha256) {
    throw new Error('[daily-visual] private candidate hash mismatch before QA.');
  }
  return bytes;
}
