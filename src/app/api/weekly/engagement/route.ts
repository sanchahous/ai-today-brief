import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENT_TYPES = new Set([
  'digest_view',
  'scroll_50',
  'story_open',
  'subscribe_click',
  'signup_complete',
  'pdf_download',
  'video_play',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function shortString(value: unknown, max: number) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(SITE_URL).origin) {
        return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const eventType = shortString(body.eventType, 32);
  const digestId = shortString(body.digestId, 64);
  const revisionId = shortString(body.revisionId, 64);
  const storyId = shortString(body.storyId, 64);
  const locale = body.locale === 'uk' ? 'uk' : body.locale === 'en' ? 'en' : null;
  const sessionKey = shortString(body.sessionKey, 128);
  if (
    !eventType ||
    !EVENT_TYPES.has(eventType) ||
    !digestId ||
    !UUID.test(digestId) ||
    !revisionId ||
    !UUID.test(revisionId) ||
    !locale ||
    !sessionKey ||
    (storyId !== null && !UUID.test(storyId))
  ) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: digest } = await db
    .from('weekly_digests')
    .select('id,published_revision_id')
    .eq('id', digestId)
    .eq('status', 'published')
    .eq('published_revision_id', revisionId)
    .maybeSingle();
  if (!digest) return NextResponse.json({ error: 'digest_not_published' }, { status: 404 });

  const sessionHash = createHash('sha256')
    .update(`${process.env.WEEKLY_ANALYTICS_SALT ?? SITE_URL}:${sessionKey}`)
    .digest('hex');
  const { error } = await db.from('weekly_digest_engagement_events').insert({
    weekly_digest_id: digestId,
    revision_id: revisionId,
    event_type: eventType,
    locale,
    channel: shortString(body.channel, 40),
    hook_angle: shortString(body.hookAngle, 160),
    story_id: storyId,
    session_hash: sessionHash,
    metadata: {
      pathname: shortString(body.pathname, 240),
      referrer_host: shortString(body.referrerHost, 160),
    },
  });
  if (error) return NextResponse.json({ error: 'event_not_recorded' }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
