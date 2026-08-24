import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isLang, SITE_URL } from '@/lib/site';
import {
  isDailyVisualEngagementEvent,
  type DailyVisualEntrySource,
} from '@/lib/daily-visual-engagement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_BODY_KEYS = new Set([
  'eventType',
  'dailyVisualSetId',
  'candidateId',
  'entrySource',
  'lang',
]);
const BOT_RE =
  /bot|crawl|spider|slurp|bing|google|yandex|baidu|duckduck|facebookexternalhit|embedly|preview|monitor|headless|phantom|curl|wget|python-requests|axios|node-fetch/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyEventFields(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => EVENT_BODY_KEYS.has(key));
}

function shortString(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

function isEntrySource(value: unknown): value is DailyVisualEntrySource {
  return value === 'entry_hero' || value === 'scrolled';
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(SITE_URL).origin;
  } catch {
    return false;
  }
}

function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? '';
  return headers.get('x-real-ip')?.trim() ?? '';
}

/** Matches item_events: sha256(ip + ua + UTC day + salt), then discards all inputs. */
function dailySessionHash(request: Request): string {
  const ip = clientIp(request.headers);
  const ua = request.headers.get('user-agent') ?? '';
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.EVENT_SALT ?? '';
  return createHash('sha256').update(`${ip}|${ua}|${day}|${salt}`).digest('hex');
}

export async function POST(request: Request): Promise<Response> {
  if (!isOriginAllowed(request.headers.get('origin'))) {
    return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!isRecord(parsed) || !hasOnlyEventFields(parsed)) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  }

  const eventType = shortString(parsed.eventType, 32);
  const visualSetId = shortString(parsed.dailyVisualSetId, 64);
  const candidateId = shortString(parsed.candidateId, 64);
  const lang = isLang(parsed.lang) ? parsed.lang : null;
  const entrySource = parsed.entrySource;
  if (
    !eventType ||
    !isDailyVisualEngagementEvent(eventType) ||
    !visualSetId ||
    !UUID_RE.test(visualSetId) ||
    !candidateId ||
    !UUID_RE.test(candidateId) ||
    !lang ||
    !isEntrySource(entrySource)
  ) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  }

  // Automated requests are discarded before the database lookup. The raw
  // user-agent is used only for this transient safeguard and never stored.
  if (BOT_RE.test(request.headers.get('user-agent') ?? '')) {
    return new NextResponse(null, { status: 204 });
  }

  const db = getSupabaseAdmin();
  const { data: publication, error: publicationError } = await db
    .from('daily_visual_publications')
    .select('editorial_date')
    .eq('daily_visual_set_id', visualSetId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (publicationError) return NextResponse.json({ error: 'event_not_recorded' }, { status: 500 });
  if (!publication) return NextResponse.json({ error: 'visual_not_published' }, { status: 404 });

  const { data: activeSet, error: activeSetError } = await db
    .from('daily_visual_sets')
    .select('editorial_date')
    .eq('id', visualSetId)
    .eq('active_candidate_id', candidateId)
    .eq('status', 'active')
    .maybeSingle();
  if (activeSetError) return NextResponse.json({ error: 'event_not_recorded' }, { status: 500 });
  if (!activeSet || activeSet.editorial_date !== publication.editorial_date) {
    return NextResponse.json({ error: 'visual_not_published' }, { status: 404 });
  }

  const { data: publishedBrief, error: briefError } = await db
    .from('briefs')
    .select('id')
    .eq('date', publication.editorial_date)
    .eq('status', 'published')
    .limit(1)
    .maybeSingle();
  if (briefError) return NextResponse.json({ error: 'event_not_recorded' }, { status: 500 });
  if (!publishedBrief) return NextResponse.json({ error: 'visual_not_published' }, { status: 404 });

  // The RPC keeps proof of the preceding impression and the write in one
  // database statement. A beacon that races before its impression commits
  // returns false and is intentionally dropped instead of becoming an orphan.
  const { error } = await db.rpc('record_daily_visual_engagement', {
    p_daily_visual_set_id: visualSetId,
    p_candidate_id: candidateId,
    p_event_type: eventType,
    p_entry_source: entrySource,
    p_lang: lang,
    p_session_hash: dailySessionHash(request),
  });
  if (error) return NextResponse.json({ error: 'event_not_recorded' }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
