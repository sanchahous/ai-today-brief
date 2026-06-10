/**
 * Parse `/custom` commands from the Telegram review chat.
 * Pure — unit-tested.
 */

export interface ParsedCustomCommand {
  topic: string;
  url?: string;
}

/** Strip bot mention suffix: /custom@MyBotName */
function stripCustomPrefix(text: string): string {
  return text.replace(/^\/custom(?:@\w+)?\s*/i, '').trim();
}

function isHttpUrl(token: string): boolean {
  return token.startsWith('http://') || token.startsWith('https://');
}

/**
 * `/custom NVIDIA Nemotron 3 Ultra`
 * `/custom https://developer.nvidia.com/blog/foo Nemotron release`
 */
export function parseCustomCommand(text: string): ParsedCustomCommand | null {
  const body = stripCustomPrefix(text.trim());
  if (!body) return null;

  const parts = body.split(/\s+/);
  if (parts.length > 0 && isHttpUrl(parts[0] ?? '')) {
    const url = parts[0]!;
    const topic = parts.slice(1).join(' ').trim();
    if (!topic) return { topic: url, url };
    return { topic, url };
  }

  return { topic: body };
}

/** User-facing hint for Telegram when custom-news fails at config/runtime. */
export function formatCustomNewsError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (raw.includes('GEMINI_API_KEY')) {
    return [
      'На Vercel не задано <code>GEMINI_API_KEY</code>.',
      '',
      'Vercel → Project → Settings → Environment Variables:',
      '• <code>GEMINI_API_KEY</code> (той самий, що в GitHub Secrets для pipeline)',
      '• Production (+ Preview за бажанням)',
      '',
      'Після збереження — Redeploy, потім повтори <code>/custom</code>.',
    ].join('\n');
  }

  if (raw.includes('SCRAPPER_BASE_URL') || raw.includes('SCRAPPER_SERVICE_KEY')) {
    return [
      'На Vercel не вистачає Supabase service env.',
      'Потрібно: <code>SUPABASE_SERVICE_ROLE_KEY</code> + <code>NEXT_PUBLIC_SUPABASE_URL</code>',
      '(або <code>SCRAPPER_*</code> як у pipeline).',
    ].join('\n');
  }

  return raw.length > 400 ? `${raw.slice(0, 400)}…` : raw;
}
