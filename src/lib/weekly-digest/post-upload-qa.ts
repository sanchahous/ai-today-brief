/**
 * Post-upload illustration QA is advisory. It never feeds preflight
 * `contentSimCleared` — a failed check warns in Visuals and the owner decides.
 */
export const POST_UPLOAD_QA_PENDING = { pending: true as const };

export interface PostUploadQaBlocker {
  code: string;
  message: string;
  region?: string;
  blocker: boolean;
}

export interface PostUploadQa {
  pending?: boolean;
  blockers: PostUploadQaBlocker[];
  scores: Record<string, number>;
  model: string | null;
  cost_usd: number;
  checked_at: string | null;
  ignored?: boolean;
  error?: string;
}

const BLOCKER_LABEL_UK: Record<string, string> = {
  readable_text: 'впечений текст',
  ui_chrome: 'UI chrome',
  collage_panels: 'колаж',
  banned_cliche: 'кліше',
  melted_motion: 'розмитий рух',
  brand_unsafe: 'небезпечно для бренду',
  human_dignity_risk: 'ризик гідності',
  low_quality: 'низька якість',
  impossible_orientation: 'перевернутий обʼєкт',
  prop_use_mismatch: 'неприродна дія',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseBlocker(value: unknown): PostUploadQaBlocker | null {
  const row = asRecord(value);
  const code = str(row.code);
  if (!code) return null;
  return {
    code,
    message: str(row.message) ?? code,
    region: str(row.region),
    blocker: row.blocker !== false,
  };
}

export function parsePostUploadQa(metadata: unknown): PostUploadQa | null {
  const raw = asRecord(metadata).post_upload_qa;
  if (raw === undefined || raw === null) return null;
  const row = asRecord(raw);
  if (row.pending === true && !str(row.checked_at)) {
    return { ...POST_UPLOAD_QA_PENDING, blockers: [], scores: {}, model: null, cost_usd: 0, checked_at: null };
  }
  const scores: Record<string, number> = {};
  for (const [key, value] of Object.entries(asRecord(row.scores))) {
    const n = num(value);
    if (n !== undefined) scores[key] = n;
  }
  const blockers = Array.isArray(row.blockers)
    ? row.blockers.flatMap((entry) => {
        const parsed = parseBlocker(entry);
        return parsed ? [parsed] : [];
      })
    : [];
  return {
    pending: row.pending === true,
    blockers,
    scores,
    model: str(row.model) ?? null,
    cost_usd: num(row.cost_usd) ?? 0,
    checked_at: str(row.checked_at) ?? null,
    ignored: row.ignored === true,
    error: str(row.error),
  };
}

export function ignorePostUploadQa(qa: PostUploadQa): PostUploadQa {
  return { ...qa, pending: false, ignored: true };
}

/** Manual uploads must not set preflight content-sim. Always `undefined`. */
export function contentSimClearedFromPostUploadQa(_qa: PostUploadQa | null | undefined): undefined {
  return undefined;
}

function uaPlaces(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'місце';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'місця';
  return 'місць';
}

function blockerLabel(code: string): string {
  return BLOCKER_LABEL_UK[code] ?? code.replaceAll('_', ' ');
}

export function formatPostUploadQaLine(qa: PostUploadQa): string {
  if (qa.pending) return 'QA перевіряє…';
  if (qa.ignored) return 'QA: проігноровано';
  if (qa.error) return 'QA: перевірку не вдалось завершити';
  const active = qa.blockers.filter((entry) => entry.blocker);
  if (active.length === 0) return 'QA чисто';
  const textCount = active.filter((entry) => entry.code === 'readable_text').length;
  if (textCount > 0 && textCount === active.length) {
    if (textCount === 1) return 'QA: впечений текст';
    return `QA: впечений текст (${textCount} ${uaPlaces(textCount)})`;
  }
  const labels = [...new Set(active.map((entry) => blockerLabel(entry.code)))];
  return `QA: ${labels.join(', ')}`;
}

export function postUploadQaNeedsWarning(qa: PostUploadQa | null): boolean {
  if (!qa || qa.ignored || qa.pending) return false;
  if (qa.error) return true;
  return qa.blockers.some((entry) => entry.blocker);
}

/** Owner-facing repair advice (D2). Digest QA never auto-patches or re-renders. */
export const POST_UPLOAD_ADVICE_KINDS = [
  'baked_text',
  'broken_geometry',
  'sequence_frame',
  'false_thesis',
] as const;
export type PostUploadAdviceKind = (typeof POST_UPLOAD_ADVICE_KINDS)[number];

export interface PostUploadAdvice {
  kind: PostUploadAdviceKind;
  do: string;
  dont: string;
}

const ADVICE_COPY: Record<PostUploadAdviceKind, Omit<PostUploadAdvice, 'kind'>> = {
  baked_text: {
    do: 'Локальна правка (inpaint / crop) — прибери текст у пікселях.',
    dont: 'Не перегенеровуй кадр.',
  },
  broken_geometry: {
    do: 'Перезбери композицію тим самим промптом.',
    dont: 'Не міняй концепт.',
  },
  sequence_frame: {
    do: 'Перегенеруй лише цей кадр.',
    dont: 'Не перегенеровуй усі кадри.',
  },
  false_thesis: {
    do: 'Візьми інший концепт із трьох.',
    dont: 'Не патч лейблами.',
  },
};

export function adviceKindForBlockerCode(code: string): PostUploadAdviceKind | null {
  if (code === 'readable_text' || code === 'ui_chrome') return 'baked_text';
  if (
    code === 'melted_motion' ||
    code === 'impossible_orientation' ||
    code === 'collage_panels' ||
    code === 'prop_use_mismatch'
  ) {
    return 'broken_geometry';
  }
  if (code === 'failed_sequence_state' || code === 'sequence_state_count_invalid') {
    return 'sequence_frame';
  }
  if (
    code === 'off_metaphor' ||
    code === 'off_news' ||
    code === 'missing_context' ||
    code === 'missing_mechanism' ||
    code === 'missing_consequence' ||
    code === 'ambiguous_visual_story' ||
    code === 'wrong_subject' ||
    code === 'opaque_abstraction' ||
    code === 'semantic_evidence_missing' ||
    code === 'decorative_second_beat' ||
    code === 'human_dignity_risk'
  ) {
    return 'false_thesis';
  }
  return null;
}

export function adviceForPostUploadQa(qa: PostUploadQa): PostUploadAdvice[] {
  if (qa.ignored || qa.pending || qa.error) return [];
  const rows: PostUploadAdvice[] = [];
  for (const kind of POST_UPLOAD_ADVICE_KINDS) {
    if (!qaHasAdviceKind(qa, kind)) continue;
    rows.push({ kind, ...ADVICE_COPY[kind] });
  }
  return rows;
}

function qaHasAdviceKind(qa: PostUploadQa, kind: PostUploadAdviceKind): boolean {
  for (const entry of qa.blockers) {
    if (!entry.blocker) continue;
    if (adviceKindForBlockerCode(entry.code) === kind) return true;
  }
  return false;
}
