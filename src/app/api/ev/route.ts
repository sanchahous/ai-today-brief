import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * First-party per-item interaction beacon — the audience reward signal (migration
 * 035). Receives tiny POSTs from `navigator.sendBeacon` (see `trackItemEvent` in
 * analytics-client). PII-free: we hash ip+ua+date into a daily-rotating
 * `session_hash` and store only that + a coarse `ua_class` — never raw ip/ua, so
 * we count interactions, not people. Always responds fast and never throws back at
 * the client: a failed insert must not affect the page the reader is on.
 *
 * Contract: POST JSON `{ id?: uuid, slug?: string, type: EventType, value?: number, lang?: string }`.
 * At least one of `id` / `slug` is required (id maps to brief_item_id; slug lets the
 * rollup resolve items whose id the client doesn't have on hand).
 */

const EVENT_TYPES = new Set([
  'view',
  'post_expand',
  'scroll_50',
  'scroll_90',
  'save_toggle',
  'outbound_click',
  'share',
  'dwell',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Drop obvious automated agents — they pollute the reward signal and rarely run
// sendBeacon anyway. Conservative: only well-known crawler/tool markers.
const BOT_RE =
  /bot|crawl|spider|slurp|bing|google|yandex|baidu|duckduck|facebookexternalhit|embedly|preview|monitor|headless|phantom|curl|wget|python-requests|axios|node-fetch/i;

function classifyUa(ua: string): 'human' | 'bot' | 'unknown' {
  if (!ua) return 'unknown';
  return BOT_RE.test(ua) ? 'bot' : 'human';
}

function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() ?? '';
  return headers.get('x-real-ip')?.trim() ?? '';
}

/** sha256(ip + ua + yyyy-mm-dd + salt) — rotates daily; raw ip/ua are discarded. */
function sessionHash(ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.EVENT_SALT ?? '';
  return createHash('sha256').update(`${ip}|${ua}|${day}|${salt}`).digest('hex');
}

function status(code: number): Response {
  return new Response(null, { status: code });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    // sendBeacon posts text/plain; read raw text and parse so content-type can't trip us.
    body = JSON.parse(await request.text());
  } catch {
    return status(400);
  }
  if (!body || typeof body !== 'object') return status(400);

  const b = body as Record<string, unknown>;

  const type = typeof b.type === 'string' ? b.type : '';
  if (!EVENT_TYPES.has(type)) return status(400);

  const slug = typeof b.slug === 'string' && b.slug ? b.slug.slice(0, 256) : null;
  const id = typeof b.id === 'string' && UUID_RE.test(b.id) ? b.id : null;
  if (!slug && !id) return status(400);

  const value = typeof b.value === 'number' && Number.isFinite(b.value) ? b.value : null;
  const lang = typeof b.lang === 'string' ? b.lang.slice(0, 8) : null;

  const ua = request.headers.get('user-agent') ?? '';
  const uaClass = classifyUa(ua);
  if (uaClass === 'bot') return status(204);

  const session = sessionHash(clientIp(request.headers), ua);

  try {
    const { error } = await getSupabaseAdmin().from('item_events').insert({
      brief_item_id: id,
      slug,
      event_type: type,
      value,
      session_hash: session,
      lang,
      ua_class: uaClass,
    });
    if (error) console.error('[ev] insert failed:', error.message);
  } catch (err) {
    console.error('[ev] beacon failed:', err instanceof Error ? err.message : String(err));
  }

  return status(204);
}
