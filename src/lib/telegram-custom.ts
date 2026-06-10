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
