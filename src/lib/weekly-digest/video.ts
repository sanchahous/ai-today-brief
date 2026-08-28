const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

function validId(value: string | null | undefined) {
  const candidate = value?.trim() ?? '';
  return YOUTUBE_ID.test(candidate) ? candidate : null;
}

export function parseYouTubeVideoId(value: string): string | null {
  const input = value.trim();
  const directId = validId(input);
  if (directId) return directId;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'youtu.be') {
    return validId(url.pathname.split('/').filter(Boolean)[0]);
  }
  if (!YOUTUBE_HOSTS.has(hostname)) return null;

  if (url.pathname === '/watch') return validId(url.searchParams.get('v'));
  const [kind, id] = url.pathname.split('/').filter(Boolean);
  if (kind === 'embed' || kind === 'shorts' || kind === 'live') return validId(id);
  return null;
}

export interface NormalizedYouTubeVideo {
  videoId: string;
  watchUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
}

export function normalizeYouTubeVideo(value: string): NormalizedYouTubeVideo | null {
  const videoId = parseYouTubeVideoId(value);
  if (!videoId) return null;
  return {
    videoId,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  };
}

export function isValidYouTubeVideo(value: string) {
  return parseYouTubeVideoId(value) !== null;
}

export interface WeeklyVideoResultManifest {
  schemaVersion: 'weekly-video-result-v2';
  digestId: string;
  revisionId: string;
  inputHash: string;
  youtube: {
    id: string;
    url: string;
    thumbnailUrl: string;
    durationSeconds: number;
    publishedAt: string;
  };
  captions: Array<{ locale: 'en' | 'uk'; url?: string; vtt?: string }>;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Video result manifest must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

function requiredManifestString(value: Record<string, unknown>, key: string) {
  const candidate = value[key];
  if (typeof candidate !== 'string' || !candidate.trim()) {
    throw new Error(`Video result manifest requires ${key}.`);
  }
  return candidate.trim();
}

export function validateWeeklyVideoResultManifest(
  value: unknown,
  expected: { digestId: string; revisionId: string; inputHash: string },
): WeeklyVideoResultManifest {
  const manifest = record(value);
  if (manifest.schemaVersion !== 'weekly-video-result-v2') {
    throw new Error('Video result manifest must use weekly-video-result-v2.');
  }
  const digestId = requiredManifestString(manifest, 'digestId');
  const revisionId = requiredManifestString(manifest, 'revisionId');
  const inputHash = requiredManifestString(manifest, 'inputHash');
  if (
    digestId !== expected.digestId ||
    revisionId !== expected.revisionId ||
    inputHash !== expected.inputHash
  ) {
    throw new Error(
      'Video result manifest does not match the approved digest, revision and input hash.',
    );
  }
  const youtubeRow = record(manifest.youtube);
  const id = requiredManifestString(youtubeRow, 'id');
  const url = requiredManifestString(youtubeRow, 'url');
  const normalized = normalizeYouTubeVideo(url);
  if (!normalized || normalized.videoId !== id) {
    throw new Error('Video result manifest contains an invalid or mismatched YouTube ID.');
  }
  const thumbnailUrl = requiredManifestString(youtubeRow, 'thumbnailUrl');
  if (!thumbnailUrl.startsWith('https://')) throw new Error('Video thumbnail URL must use HTTPS.');
  const durationSeconds = Number(youtubeRow.durationSeconds);
  if (!Number.isInteger(durationSeconds) || durationSeconds < 200 || durationSeconds > 1200) {
    throw new Error('Weekly YouTube duration must be between 200 and 1200 seconds.');
  }
  const publishedAt = requiredManifestString(youtubeRow, 'publishedAt');
  if (!Number.isFinite(Date.parse(publishedAt))) throw new Error('Video publishedAt is invalid.');
  if (!Array.isArray(manifest.captions)) throw new Error('Video captions must be an array.');
  const captions = manifest.captions.map((entry) => {
    const caption = record(entry);
    if (caption.locale !== 'en' && caption.locale !== 'uk') {
      throw new Error('Video captions require EN and UK locales.');
    }
    const locale = caption.locale as 'en' | 'uk';
    const urlValue = typeof caption.url === 'string' ? caption.url.trim() : undefined;
    const vtt = typeof caption.vtt === 'string' ? caption.vtt.trim() : undefined;
    if (!urlValue && !vtt) throw new Error(`Caption ${locale} requires a URL or VTT text.`);
    if (urlValue && !urlValue.startsWith('https://'))
      throw new Error('Caption URLs must use HTTPS.');
    return { locale, ...(urlValue ? { url: urlValue } : {}), ...(vtt ? { vtt } : {}) };
  });
  if (
    !(['en', 'uk'] as const).every((locale) =>
      captions.some((caption) => caption.locale === locale),
    )
  ) {
    throw new Error('Video result manifest requires both EN and UK captions.');
  }
  return {
    schemaVersion: 'weekly-video-result-v2',
    digestId,
    revisionId,
    inputHash,
    youtube: {
      id,
      url: normalized.watchUrl,
      thumbnailUrl,
      durationSeconds,
      publishedAt,
    },
    captions,
  };
}
