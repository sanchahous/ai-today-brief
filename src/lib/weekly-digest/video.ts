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
