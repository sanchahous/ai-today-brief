/**
 * Service-role Supabase client — server-only, bypasses RLS.
 * Used exclusively in route handlers and Server Actions.
 * NEVER import this in a Client Component or expose to the browser.
 */
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

let cached: SupabaseClient<Database> | null | undefined;

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (cached !== undefined) return cached!;
  const url =
    process.env.SCRAPPER_BASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SCRAPPER_SERVICE_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('[supabase-admin] SCRAPPER_BASE_URL / SCRAPPER_SERVICE_KEY not set');
  cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
