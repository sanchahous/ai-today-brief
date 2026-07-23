import { NextResponse, type NextRequest } from 'next/server';
import { resolveAdminAuthDestination } from '@/lib/admin-login';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const destination = resolveAdminAuthDestination(request.nextUrl.searchParams.get('next'));
  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, request.url));
  }
  return NextResponse.redirect(new URL('/admin/login?error=callback_session', request.url));
}
